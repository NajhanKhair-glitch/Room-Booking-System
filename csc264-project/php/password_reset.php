<?php
/**
 * =====================================================
 * PASSWORD RESET — OTP flow
 * =====================================================
 *  POST password_reset.php?action=request_otp
 *       body: {email}
 *       → generates a 6-digit OTP, stores it hashed (10-min expiry),
 *         "emails" it, and (in demo mode) returns it for on-screen display.
 *
 *  POST password_reset.php?action=verify_otp
 *       body: {email, otp}
 *       → checks the OTP; on success issues a one-time reset_token.
 *
 *  POST password_reset.php?action=reset_password
 *       body: {email, token, new_password}
 *       → sets the new password and consumes the token.
 *
 *  Security: OTP is hashed (never stored in clear), expires in 10 min,
 *  max 5 verify attempts, 45-second resend cooldown, single-use token,
 *  and previous OTPs for the same email are invalidated on each request.
 * =====================================================
 */

require_once 'db_config.php';

/* ── Config ──────────────────────────────────────────
 * On XAMPP localhost, PHP mail() usually can't deliver, so for the demo
 * the OTP is also returned in the response and shown on screen.
 * Set this to FALSE in production so the OTP is ONLY sent by email. */
define('RESET_DEMO_REVEAL', true);
define('OTP_TTL_MIN', 10);          // OTP lifetime (minutes)
define('OTP_MAX_ATTEMPTS', 5);      // wrong tries before the OTP is burned
define('OTP_RESEND_COOLDOWN', 45);  // seconds between sends

$action = $_GET['action'] ?? $_POST['action'] ?? '';

// readJsonBody() lives in auth.php (which we must NOT include here, as it runs its
// own dispatcher). Define a self-contained copy.
if (!function_exists('readJsonBody')) {
    function readJsonBody() {
        $raw = file_get_contents('php://input');
        $j = json_decode($raw, true);
        return is_array($j) ? $j : [];
    }
}

function maskEmail($email) {
    $parts = explode('@', $email);
    $name  = $parts[0];
    $dom   = $parts[1] ?? '';
    $keep  = max(1, min(2, strlen($name) - 1));
    return substr($name, 0, $keep) . str_repeat('*', max(2, strlen($name) - $keep)) . '@' . $dom;
}

/** Best-effort email; never breaks the flow if the mail server is absent. */
function sendOtpEmail($to, $name, $otp) {
    $subject = 'Your Room Booking System password reset code';
    $body =
        "Hi $name,\n\n" .
        "Your one-time password (OTP) to reset your Room Booking System password is:\n\n" .
        "    $otp\n\n" .
        "This code expires in " . OTP_TTL_MIN . " minutes. If you did not request a reset, ignore this email.\n\n" .
        "— UiTM Cawangan Perak · Room Booking System";
    $headers = 'From: no-reply@tapah.uitm.edu.my' . "\r\n" . 'Content-Type: text/plain; charset=UTF-8';
    return @mail($to, $subject, $body, $headers);
}

switch ($action) {

    /* ── 1) Request an OTP ── */
    case 'request_otp': {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(false, 'POST required');
        $data  = readJsonBody();
        $email = strtolower(trim($data['email'] ?? ''));
        if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(false, 'Please enter a valid email address.');
        }

        $user = queryOne(
            "SELECT id, full_name, email, status FROM users WHERE email = ? LIMIT 1",
            [$email], 's'
        );
        if (!$user || $user['status'] !== 'Active') {
            jsonResponse(false, 'No active account is registered with this email.');
        }

        $conn = dbConnect();

        // Resend cooldown — block rapid re-requests
        $recent = queryOne(
            "SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) AS age
             FROM password_reset WHERE email = ? ORDER BY id DESC LIMIT 1",
            [$email], 's'
        );
        if ($recent && intval($recent['age']) < OTP_RESEND_COOLDOWN) {
            $wait = OTP_RESEND_COOLDOWN - intval($recent['age']);
            jsonResponse(false, "Please wait {$wait}s before requesting another code.");
        }

        // Invalidate any earlier OTPs for this email
        $conn->query("UPDATE password_reset SET used = 1 WHERE email = '" .
            $conn->real_escape_string($email) . "' AND used = 0");

        $otp      = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $otpHash  = password_hash($otp, PASSWORD_DEFAULT);
        $uid      = intval($user['id']);

        // Compute expiry with MySQL's clock (NOW()) so the later "expires_at < NOW()"
        // check uses the same timezone — never PHP's date() vs MySQL's NOW().
        $stmt = $conn->prepare(
            "INSERT INTO password_reset (user_id, email, otp_hash, expires_at)
             VALUES (?, ?, ?, NOW() + INTERVAL " . intval(OTP_TTL_MIN) . " MINUTE)"
        );
        $stmt->bind_param('iss', $uid, $email, $otpHash);
        if (!$stmt->execute()) jsonResponse(false, 'Could not start the reset. Please try again.');
        $stmt->close();

        $emailed = sendOtpEmail($user['email'], $user['full_name'], $otp);

        $payload = [
            'masked_email' => maskEmail($user['email']),
            'expires_in'   => OTP_TTL_MIN * 60,
            'emailed'      => (bool) $emailed,
        ];
        // Demo only: surface the OTP so it can be shown on screen (localhost can't email).
        if (RESET_DEMO_REVEAL) $payload['demo_otp'] = $otp;

        jsonResponse(true, 'A 6-digit code has been sent to your email.', $payload);
        break;
    }

    /* ── 2) Verify the OTP ── */
    case 'verify_otp': {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(false, 'POST required');
        $data  = readJsonBody();
        $email = strtolower(trim($data['email'] ?? ''));
        $otp   = trim($data['otp'] ?? '');
        if (!$email || !$otp) jsonResponse(false, 'Email and OTP are required.');

        $row = queryOne(
            "SELECT id, otp_hash, attempts,
                    (expires_at < NOW()) AS expired
             FROM password_reset
             WHERE email = ? AND used = 0
             ORDER BY id DESC LIMIT 1",
            [$email], 's'
        );
        if (!$row) jsonResponse(false, 'No active code. Please request a new one.');

        $conn = dbConnect();
        $id   = intval($row['id']);

        if (intval($row['expired']) === 1) {
            $conn->query("UPDATE password_reset SET used = 1 WHERE id = $id");
            jsonResponse(false, 'This code has expired. Please request a new one.');
        }
        if (intval($row['attempts']) >= OTP_MAX_ATTEMPTS) {
            $conn->query("UPDATE password_reset SET used = 1 WHERE id = $id");
            jsonResponse(false, 'Too many incorrect attempts. Please request a new code.');
        }

        if (!password_verify($otp, $row['otp_hash'])) {
            $conn->query("UPDATE password_reset SET attempts = attempts + 1 WHERE id = $id");
            $left = OTP_MAX_ATTEMPTS - (intval($row['attempts']) + 1);
            jsonResponse(false, 'Incorrect code.' . ($left > 0 ? " {$left} attempt(s) left." : ' No attempts left.'));
        }

        // Correct — issue a single-use reset token tied to this row
        $token = bin2hex(random_bytes(24));
        $stmt  = $conn->prepare("UPDATE password_reset SET reset_token = ?, attempts = 0 WHERE id = ?");
        $stmt->bind_param('si', $token, $id);
        $stmt->execute();
        $stmt->close();

        jsonResponse(true, 'Code verified.', ['token' => $token]);
        break;
    }

    /* ── 3) Set the new password ── */
    case 'reset_password': {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonResponse(false, 'POST required');
        $data  = readJsonBody();
        $email = strtolower(trim($data['email'] ?? ''));
        $token = trim($data['token'] ?? '');
        $new   = $data['new_password'] ?? '';
        if (!$email || !$token) jsonResponse(false, 'Invalid reset session. Please start again.');
        if (strlen($new) < 6)   jsonResponse(false, 'Password must be at least 6 characters.');

        $row = queryOne(
            "SELECT id, user_id, (expires_at < NOW()) AS expired
             FROM password_reset
             WHERE email = ? AND reset_token = ? AND used = 0
             ORDER BY id DESC LIMIT 1",
            [$email, $token], 'ss'
        );
        if (!$row) jsonResponse(false, 'Invalid or used reset link. Please start again.');
        if (intval($row['expired']) === 1) jsonResponse(false, 'Your reset session expired. Please start again.');

        updateData(
            dbConnect(), 'users',
            ['password' => password_hash($new, PASSWORD_DEFAULT)],
            'id', intval($row['user_id'])
        );
        dbConnect()->query("UPDATE password_reset SET used = 1 WHERE id = " . intval($row['id']));

        jsonResponse(true, 'Your password has been reset. You can now log in.');
        break;
    }

    default:
        jsonResponse(false, 'Invalid action');
}
