<?php
/**
 * =====================================================
 * ADMIN DASHBOARD - BOOKING OPERATIONS
 * =====================================================
 *
 * Bookings live in a single `bookings` table with a status
 * column. "Booking requests" = rows where status='Pending'.
 */

require_once 'db_config.php';
require_once 'auth.php';
require_once 'notifications.php';

requireRole(['Moderator', 'Admin']);

$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {

    // GET: bookings with status='Pending' (the "requests" tab)
    case 'get_booking_requests':
        $rows = queryAll(
            "SELECT r.reservation_id AS id, r.reservation_title, r.event AS event_name, r.no_participants AS total_participants,
                    r.start_date, r.end_date, r.start_time, r.end_time,
                    r.apply_date AS applied_date, sr.status, sr.review_notes,
                    u.user_id AS user_id, u.name AS applicant,
                    u.email, u.contact_no AS phone, s.faculty AS department,
                    s.space_id AS space_id, s.space_code, s.space_name, s.space_category AS category
             FROM reservation r
             JOIN space_reservation sr ON sr.reservation_id = r.reservation_id
             JOIN user u ON r.user_id = u.user_id
             JOIN space s ON sr.space_id = s.space_id
             WHERE sr.status = 'Pending'
             ORDER BY r.apply_date DESC, r.reservation_id DESC",
            [], ''
        );
        jsonResponse(true, 'Success', $rows);
        break;

    // GET: all bookings (any status) for the admin table
    case 'get_all_bookings':
        $rows = queryAll(
            "SELECT r.reservation_id AS id, r.reservation_title, r.event AS event_name, r.no_participants AS total_participants,
                    r.start_date, r.end_date, r.start_time, r.end_time,
                    r.apply_date AS applied_date, sr.status,
                    u.user_id AS user_id, u.name AS applicant,
                    u.email, u.contact_no AS phone, s.faculty AS department,
                    s.space_id AS space_id, s.space_code, s.space_name, s.space_category AS category
             FROM reservation r
             JOIN space_reservation sr ON sr.reservation_id = r.reservation_id
             JOIN user u ON r.user_id = u.user_id
             JOIN space s ON sr.space_id = s.space_id
             ORDER BY r.start_date DESC, r.reservation_id DESC",
            [], ''
        );
        jsonResponse(true, 'Success', $rows);
        break;

    // GET: a single booking's full detail
    case 'get_booking_detail':
        $booking_id = intval($_GET['booking_id'] ?? 0);
        if (!$booking_id) { jsonResponse(false, 'booking_id required'); }
        $row = queryOne(
            "SELECT r.*, r.no_participants AS total_participants,
                    sr.status, sr.review_notes, sr.approval_date,
                    u.user_id AS user_id, u.name AS applicant, u.email, u.contact_no AS phone,
                    COALESCE(st.student_no, sf.staff_no) AS student_no,
                    s.space_code, s.space_name, s.space_category AS category, s.campus,
                    s.faculty AS department, s.operation_time, s.seating_capacity
             FROM reservation r
             JOIN space_reservation sr ON sr.reservation_id = r.reservation_id
             JOIN user u ON r.user_id = u.user_id
             LEFT JOIN student st ON st.user_id = u.user_id
             LEFT JOIN staff sf ON sf.user_id = u.user_id
             JOIN space s ON sr.space_id = s.space_id
             WHERE r.reservation_id = ?",
            [$booking_id], 'i'
        );
        if (!$row) { jsonResponse(false, 'Booking not found'); }
        jsonResponse(true, 'Success', $row);
        break;

    // POST: approve a pending booking
    case 'approve_request':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(false, 'POST required'); }
        $data = readJsonBody();
        $booking_id = intval($data['booking_id'] ?? 0);
        $notes      = trim($data['notes'] ?? '');
        if (!$booking_id) { jsonResponse(false, 'booking_id required'); }

        $admin_id = currentUserId();
        $conn = dbConnect();
        $stmt = $conn->prepare(
            "UPDATE space_reservation
             SET status='Approved', reviewed_by=?, review_notes=?, approval_date=NOW()
             WHERE reservation_id=? AND status='Pending'"
        );
        $stmt->bind_param('isi', $admin_id, $notes, $booking_id);
        $stmt->execute();
        if ($stmt->affected_rows < 1) {
            jsonResponse(false, 'Booking not found or already reviewed');
        }

        // Get booking details for email + notification
        $booking = queryOne(
            "SELECT r.reservation_id AS id, r.user_id AS user_id, r.reservation_title, r.event AS event_name, r.start_date,
                    u.name AS full_name, u.email, s.space_name
             FROM reservation r
             JOIN space_reservation sr ON sr.reservation_id = r.reservation_id
             JOIN user u ON r.user_id = u.user_id
             JOIN space s ON sr.space_id = s.space_id
             WHERE r.reservation_id = ?",
            [$booking_id], 'i'
        );
        if ($booking) {
            sendBookingNotificationEmail(
                $booking['email'],
                $booking['full_name'],
                $booking,
                'Approved',
                $notes
            );
            // Create in-app notification
            $title = '✓ Booking Approved';
            $message = "Your booking '{$booking['event_name']}' at {$booking['space_name']} on {$booking['start_date']} has been approved."
                     . ($notes ? " Notes: $notes" : '');
            createNotification(intval($booking['user_id']), 'approval', $title, $message, 'reservation', $booking_id);
        }

        logAdminAction($admin_id, 'Approve Booking', 'reservation', $booking_id, ['notes' => $notes]);
        jsonResponse(true, 'Booking approved and notification sent');
        break;

    // POST: reject a pending booking
    case 'reject_request':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(false, 'POST required'); }
        $data = readJsonBody();
        $booking_id = intval($data['booking_id'] ?? 0);
        $reason     = trim($data['reason'] ?? '');
        if (!$booking_id) { jsonResponse(false, 'booking_id required'); }

        $admin_id = currentUserId();
        $conn = dbConnect();
        $stmt = $conn->prepare(
            "UPDATE space_reservation
             SET status='Rejected', reviewed_by=?, review_notes=?, approval_date=NOW()
             WHERE reservation_id=? AND status='Pending'"
        );
        $stmt->bind_param('isi', $admin_id, $reason, $booking_id);
        $stmt->execute();
        if ($stmt->affected_rows < 1) {
            jsonResponse(false, 'Booking not found or already reviewed');
        }

        // Get booking details for email + notification
        $booking = queryOne(
            "SELECT r.reservation_id AS id, r.user_id AS user_id, r.reservation_title, r.event AS event_name, r.start_date,
                    u.name AS full_name, u.email, s.space_name
             FROM reservation r
             JOIN space_reservation sr ON sr.reservation_id = r.reservation_id
             JOIN user u ON r.user_id = u.user_id
             JOIN space s ON sr.space_id = s.space_id
             WHERE r.reservation_id = ?",
            [$booking_id], 'i'
        );
        if ($booking) {
            sendBookingNotificationEmail(
                $booking['email'],
                $booking['full_name'],
                $booking,
                'Rejected',
                $reason
            );
            // Create in-app notification
            $title = '✗ Booking Rejected';
            $message = "Your booking '{$booking['event_name']}' at {$booking['space_name']} on {$booking['start_date']} has been rejected."
                     . ($reason ? " Reason: $reason" : '');
            createNotification(intval($booking['user_id']), 'rejection', $title, $message, 'reservation', $booking_id);
        }

        logAdminAction($admin_id, 'Reject Booking', 'reservation', $booking_id, ['reason' => $reason]);
        jsonResponse(true, 'Booking rejected and notification sent');
        break;

    // POST: cancel an existing booking (admin-side)
    case 'cancel_booking':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(false, 'POST required'); }
        $data = readJsonBody();
        $booking_id = intval($data['booking_id'] ?? 0);
        if (!$booking_id) { jsonResponse(false, 'booking_id required'); }

        $admin_id = currentUserId();
        $conn = dbConnect();
        $stmt = $conn->prepare(
            "UPDATE space_reservation SET status='Cancelled', reviewed_by=?, approval_date=NOW()
             WHERE reservation_id=? AND status IN ('Approved','In Progress','Pending')"
        );
        $stmt->bind_param('ii', $admin_id, $booking_id);
        $stmt->execute();
        if ($stmt->affected_rows < 1) {
            jsonResponse(false, 'Cannot cancel this booking');
        }
        logAdminAction($admin_id, 'Cancel Booking', 'bookings', $booking_id);
        jsonResponse(true, 'Booking cancelled');
        break;

    // GET: dashboard stat counts for admin overview
    case 'get_dashboard_stats':
        $pending  = queryOne("SELECT COUNT(*) AS c FROM space_reservation WHERE status='Pending'", [], '')['c'];
        $approved = queryOne("SELECT COUNT(*) AS c FROM space_reservation WHERE status='Approved'", [], '')['c'];
        $spaces   = queryOne("SELECT COUNT(*) AS c FROM space WHERE is_active=1", [], '')['c'];
        $users    = queryOne("SELECT COUNT(*) AS c FROM user WHERE status='Active'", [], '')['c'];
        jsonResponse(true, 'Success', [
            'pending'  => intval($pending),
            'approved' => intval($approved),
            'spaces'   => intval($spaces),
            'users'    => intval($users),
        ]);
        break;

    // GET: bookings for the admin calendar (with id so the cell can open details)
    case 'get_calendar_events':
        $rows = queryAll(
            "SELECT r.reservation_id AS id, r.start_date, r.end_date, sr.status,
                    r.reservation_title, r.event AS event_name,
                    r.start_time, r.end_time, u.name AS applicant,
                    s.space_id, s.space_code, s.space_name
             FROM reservation r
             JOIN space_reservation sr ON sr.reservation_id = r.reservation_id
             JOIN user u ON u.user_id = r.user_id
             JOIN space s ON sr.space_id = s.space_id
             WHERE sr.status IN ('Pending','Approved','In Progress')",
            [], ''
        );
        jsonResponse(true, 'Success', $rows);
        break;

    default:
        jsonResponse(false, 'Invalid action');
}
