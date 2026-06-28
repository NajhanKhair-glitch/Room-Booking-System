<?php
/**
 * =====================================================
 * PAYMENT ENDPOINTS — ToyyibPay (real gateway)
 * =====================================================
 *  POST payment.php?action=quote
 *       body: {space_id, start_date, end_date, start_time, end_time}
 *       → {amount, rate, hours, days, breakdown}
 *
 *  POST payment.php?action=create_bill
 *       body: {reservation_id, amount}
 *       → {pay_url}  (redirect the browser there to pay)  |  {free:true} for RM0 bookings
 *
 *  GET  payment.php?action=return    (ToyyibPay redirects the browser here after paying)
 *       → verifies the bill, marks the payment Paid/Failed, redirects to the dashboard
 *
 *  POST payment.php?action=callback  (ToyyibPay server-to-server notification)
 *       → verifies + updates the payment, replies "OK"
 *
 *  GET  payment.php?action=receipt&reservation_id=X
 *       → booking + payment details for the receipt
 */

require_once 'db_config.php';
require_once 'auth.php';
require_once 'toyyibpay_config.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';

/* ─── Helpers ─────────────────────────────────────────── */

function quoteAmount($space_id, $start_date, $end_date, $start_time, $end_time) {
    $space = queryOne(
        "SELECT id, space_name, hourly_rate, seating_capacity FROM spaces WHERE id = ?",
        [$space_id], 'i'
    );
    if (!$space) return null;
    $rate = floatval($space['hourly_rate']);

    $hours_per_day = 8.0;
    if ($start_time && $end_time) {
        $a = strtotime("1970-01-01 $start_time");
        $b = strtotime("1970-01-01 $end_time");
        if ($a !== false && $b !== false && $b > $a) $hours_per_day = ($b - $a) / 3600.0;
    }
    $days = 1;
    if ($start_date && $end_date) {
        $a = strtotime($start_date);
        $b = strtotime($end_date);
        if ($a !== false && $b !== false && $b >= $a) $days = round(($b - $a) / 86400.0) + 1;
    }
    $total_hours = $hours_per_day * $days;
    $amount      = round($rate * $total_hours, 2);
    return [
        'space_id'      => intval($space_id),
        'space_name'    => $space['space_name'],
        'rate'          => $rate,
        'hours_per_day' => $hours_per_day,
        'days'          => $days,
        'total_hours'   => $total_hours,
        'amount'        => $amount,
        'breakdown'     => "RM " . number_format($rate, 2) . " × " . $total_hours . " hour" . ($total_hours === 1.0 ? '' : 's') . " = RM " . number_format($amount, 2),
    ];
}

function genRef() {
    return 'RBS' . date('YmdHis') . strtoupper(substr(bin2hex(random_bytes(3)), 0, 5));
}

/** Build absolute URLs for the ToyyibPay return/callback + the dashboard. */
function appUrls() {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $phpDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/');         // /csc264-project/php
    $root   = rtrim(str_replace('\\', '/', dirname($phpDir)), '/');                          // /csc264-project
    return [
        'return'    => "$scheme://$host$phpDir/payment.php?action=return",
        'callback'  => "$scheme://$host$phpDir/payment.php?action=callback",
        'dashboard' => "$scheme://$host$root/source/user_dashboard.html",
    ];
}

/* ─── Dispatch ────────────────────────────────────────── */

switch ($action) {

    case 'quote':
        requireLogin();
        $data = readJsonBody();
        $space_id   = intval($data['space_id'] ?? 0);
        $start_date = $data['start_date'] ?? '';
        $end_date   = $data['end_date']   ?? '';
        $start_time = $data['start_time'] ?? null;
        $end_time   = $data['end_time']   ?? null;
        if (!$space_id || !$start_date || !$end_date) {
            jsonResponse(false, 'space_id, start_date, end_date required');
        }
        $q = quoteAmount($space_id, $start_date, $end_date, $start_time, $end_time);
        if (!$q) jsonResponse(false, 'Space not found');
        jsonResponse(true, 'Success', $q);
        break;

    /* ── Create a ToyyibPay bill and return its payment URL ── */
    case 'create_bill':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(false, 'POST required');
        $u = requireLogin();
        $data = readJsonBody();
        $reservation_id = intval($data['reservation_id'] ?? 0);
        $amount         = floatval($data['amount'] ?? 0);
        if (!$reservation_id) jsonResponse(false, 'reservation_id required');

        // Ownership check
        $res = queryOne(
            "SELECT r.reservation_id, r.user_id, r.event FROM reservation r WHERE r.reservation_id = ?",
            [$reservation_id], 'i'
        );
        if (!$res || intval($res['user_id']) !== intval($u['id'])) {
            jsonResponse(false, 'Reservation not found or not yours');
        }

        // ── Staff / lecturer benefit: bookings made by staff (Moderator/Admin)
        //    are FREE of charge. Enforced here on the server, never trusting the client. ──
        $isStaff = in_array($u['role'], ['Moderator', 'Admin'], true);
        if ($isStaff) $amount = 0;

        $conn = dbConnect();
        $ref  = genRef();

        // FREE booking (RM0, e.g. Surau) — no gateway needed, record as Paid.
        if ($amount <= 0) {
            $now = date('Y-m-d H:i:s');
            $stmt = $conn->prepare(
                "INSERT INTO payment (reservation_id, user_id, amount, method, reference_no, status, paid_at)
                 VALUES (?, ?, 0, 'FPX', ?, 'Paid', ?)"
            );
            // placeholders: reservation_id, user_id, reference_no, paid_at  → 'iiss'
            $uid = intval($u['id']);
            $stmt->bind_param('iiss', $reservation_id, $uid, $ref, $now);
            $stmt->execute();
            jsonResponse(true, 'Free booking confirmed', ['free' => true, 'reference_no' => $ref]);
        }

        if (!tpConfigured()) {
            jsonResponse(false, 'Payment gateway not set up yet. Add your ToyyibPay keys in php/toyyibpay_config.php.');
        }

        // Record a Pending payment first
        $stmt = $conn->prepare(
            "INSERT INTO payment (reservation_id, user_id, amount, method, reference_no, status)
             VALUES (?, ?, ?, 'FPX', ?, 'Pending')"
        );
        $stmt->bind_param('iids', $reservation_id, $u['id'], $amount, $ref);
        if (!$stmt->execute()) jsonResponse(false, 'Failed to record payment: ' . $stmt->error);
        $stmt->close();

        // Create the ToyyibPay bill
        $urls = appUrls();
        $phone = preg_replace('/\D/', '', $u['phone'] ?? '');
        if (strlen($phone) < 7) $phone = '0000000000';
        $bill = tpCreateBill([
            'billName'                => substr('RBS Room Booking', 0, 30),
            'billDescription'         => substr('Booking ' . $ref . ' - ' . ($res['event'] ?? 'Space'), 0, 100),
            'billAmount'              => intval(round($amount * 100)),   // cents
            'billReturnUrl'           => $urls['return'],
            'billCallbackUrl'         => $urls['callback'],
            'billExternalReferenceNo' => $ref,
            'billTo'                  => substr($u['full_name'] ?? 'Student', 0, 30),
            'billEmail'               => $u['email'] ?? 'student@uitm.edu.my',
            'billPhone'               => $phone,
        ]);

        if (isset($bill[0]['BillCode']) && $bill[0]['BillCode']) {
            $billCode = $bill[0]['BillCode'];
            $up = $conn->prepare("UPDATE payment SET bill_code = ? WHERE reference_no = ?");
            $up->bind_param('ss', $billCode, $ref);
            $up->execute();
            jsonResponse(true, 'Bill created', [
                'pay_url'      => rtrim(TOYYIBPAY_BASE, '/') . '/' . $billCode,
                'bill_code'    => $billCode,
                'reference_no' => $ref,
            ]);
        }
        // createBill failed → surface ToyyibPay's message
        $msg = $bill['msg'] ?? ($bill['error'] ?? 'Could not create payment bill');
        error_log('[ToyyibPay createBill] ' . json_encode($bill));
        jsonResponse(false, 'Payment gateway error: ' . $msg);
        break;

    /* ── Browser returns here after paying — verify + redirect to dashboard ── */
    case 'return':
        $billcode = $_GET['billcode'] ?? ($_GET['billCode'] ?? '');
        $urls = appUrls();
        $paid = false; $rid = null;

        if ($billcode) {
            $txns = tpGetTransactions($billcode);
            if (is_array($txns) && isset($txns[0]['billpaymentStatus'])) {
                $paid = ($txns[0]['billpaymentStatus'] === '1' || $txns[0]['billpaymentStatus'] === 1);
            }
            $pay = queryOne("SELECT payment_id, reservation_id FROM payment WHERE bill_code = ? ORDER BY payment_id DESC LIMIT 1", [$billcode], 's');
            if ($pay) {
                $rid = intval($pay['reservation_id']);
                $conn = dbConnect();
                if ($paid) {
                    $conn->query("UPDATE payment SET status='Paid', paid_at=NOW() WHERE bill_code='" . $conn->real_escape_string($billcode) . "' AND status<>'Paid'");
                } else {
                    $conn->query("UPDATE payment SET status='Failed' WHERE bill_code='" . $conn->real_escape_string($billcode) . "' AND status='Pending'");
                }
            }
        }
        $q = 'payment=' . ($paid ? 'success' : 'failed') . ($rid ? '&rid=' . $rid : '');
        header('Location: ' . $urls['dashboard'] . '?' . $q);
        exit;

    /* ── Server-to-server callback (production; localhost can't receive this) ── */
    case 'callback':
        $billcode = $_POST['billcode'] ?? ($_POST['billCode'] ?? '');
        if ($billcode) {
            $txns = tpGetTransactions($billcode);
            $paid = is_array($txns) && isset($txns[0]['billpaymentStatus'])
                    && ($txns[0]['billpaymentStatus'] === '1' || $txns[0]['billpaymentStatus'] === 1);
            $conn = dbConnect();
            $bc = $conn->real_escape_string($billcode);
            if ($paid) $conn->query("UPDATE payment SET status='Paid', paid_at=NOW() WHERE bill_code='$bc' AND status<>'Paid'");
            else       $conn->query("UPDATE payment SET status='Failed' WHERE bill_code='$bc' AND status='Pending'");
        }
        header('Content-Type: text/plain');
        echo 'OK';
        exit;

    case 'receipt':
        $u = requireLogin();
        $reservation_id = intval($_GET['reservation_id'] ?? 0);
        if (!$reservation_id) jsonResponse(false, 'reservation_id required');

        $row = queryOne(
            "SELECT b.id, b.reservation_title, b.event_name, b.start_date, b.end_date,
                    b.start_time, b.end_time, b.applied_date, b.total_participants, b.status,
                    s.space_name, s.space_code, s.category, s.campus, s.department, s.hourly_rate,
                    u.full_name AS applicant_name, u.student_no, u.email,
                    p.payment_id, p.amount, p.method, p.bank_name, p.card_last4,
                    p.reference_no, p.status AS payment_status, p.paid_at
             FROM bookings b
             JOIN spaces s ON b.space_id = s.id
             JOIN users  u ON b.user_id  = u.id
             LEFT JOIN payment p ON p.reservation_id = b.id
             WHERE b.id = ? AND (b.user_id = ? OR ? IN ('Moderator','Admin'))
             ORDER BY p.payment_id DESC
             LIMIT 1",
            [$reservation_id, $u['id'], $u['role']], 'iis'
        );
        if (!$row) jsonResponse(false, 'Receipt not found');
        jsonResponse(true, 'Success', $row);
        break;

    default:
        jsonResponse(false, 'Invalid action');
}
