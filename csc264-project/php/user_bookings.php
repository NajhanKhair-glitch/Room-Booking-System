<?php
/**
 * =====================================================
 * USER BOOKING OPERATIONS (student-side)
 * =====================================================
 */

require_once 'db_config.php';
require_once 'auth.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {

    // GET: bookings owned by the logged-in user
    case 'get_my_bookings':
        $u = requireLogin();
        $rows = queryAll(
            "SELECT b.id, b.reservation_title, b.event_name, b.total_participants,
                    b.start_date, b.end_date, b.start_time, b.end_time,
                    b.applied_date, b.status, b.file_attachment, b.review_notes,
                    s.space_name, s.space_code, s.category, s.campus, s.department,
                    u.full_name AS applicant_name
             FROM bookings b
             JOIN spaces s ON b.space_id = s.id
             JOIN users u  ON b.user_id  = u.id
             WHERE b.user_id = ?
             ORDER BY b.applied_date DESC, b.id DESC",
            [$u['id']], 'i'
        );
        jsonResponse(true, 'Success', $rows);
        break;

    // GET: stats for the user dashboard
    case 'get_dashboard_stats':
        $u = requireLogin();
        $total_spaces = queryOne("SELECT COUNT(*) AS c FROM spaces WHERE is_active = 1", [], '')['c'];
        $active  = queryOne("SELECT COUNT(*) AS c FROM bookings WHERE user_id = ? AND status='Approved'", [$u['id']], 'i')['c'];
        $pending = queryOne("SELECT COUNT(*) AS c FROM bookings WHERE user_id = ? AND status='Pending'",  [$u['id']], 'i')['c'];
        jsonResponse(true, 'Success', [
            'total_spaces'    => intval($total_spaces),
            'active_bookings' => intval($active),
            'pending_count'   => intval($pending),
        ]);
        break;

    // GET: events for the user's dashboard calendar
    case 'get_calendar_events':
        $u = requireLogin();
        $rows = queryAll(
            "SELECT b.id, b.reservation_title, b.event_name, b.start_date, b.end_date,
                    b.start_time, b.end_time, b.status,
                    s.space_name, s.space_code
             FROM bookings b
             JOIN spaces s ON b.space_id = s.id
             WHERE b.user_id = ? AND b.status IN ('Approved','In Progress','Pending')",
            [$u['id']], 'i'
        );
        jsonResponse(true, 'Success', $rows);
        break;

    // POST: submit a new booking, with conflict detection
    case 'submit_booking':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(false, 'POST required'); }
        $u = requireLogin();
        $data = readJsonBody();

        $required = ['space_id', 'reservation_title', 'event_name',
                     'start_date', 'end_date', 'total_participants'];
        foreach ($required as $f) {
            if (empty($data[$f]) && $data[$f] !== '0' && $data[$f] !== 0) {
                jsonResponse(false, "Field '$f' is required");
            }
        }

        // -------- Server-side validation --------
        $start_date = $data['start_date'];
        $end_date   = $data['end_date'];
        $start_time = $data['start_time'] ?? null;
        $end_time   = $data['end_time']   ?? null;

        if (strtotime($start_date) === false || strtotime($end_date) === false) {
            jsonResponse(false, 'Invalid date format');
        }
        if (strtotime($start_date) < strtotime(date('Y-m-d'))) {
            jsonResponse(false, 'Start date cannot be in the past');
        }
        if (strtotime($end_date) < strtotime($start_date)) {
            jsonResponse(false, 'End date must be on or after start date');
        }
        if ($start_time && $end_time && strtotime($start_date . ' ' . $start_time) >= strtotime($end_date . ' ' . $end_time)) {
            jsonResponse(false, 'End time must be after start time');
        }
        $participants = intval($data['total_participants']);
        if ($participants < 1) { jsonResponse(false, 'Total participants must be at least 1'); }

        $space_id = intval($data['space_id']);
        $space = queryOne("SELECT id, seating_capacity FROM spaces WHERE id = ? AND is_active = 1",
                          [$space_id], 'i');
        if (!$space) { jsonResponse(false, 'Space not found or inactive'); }
        if ($space['seating_capacity'] > 0 && $participants > $space['seating_capacity']) {
            jsonResponse(false, 'Participants exceed space capacity (' . $space['seating_capacity'] . ')');
        }

        // -------- Conflict detection (no overlapping active bookings) --------
        // Two date ranges overlap if: existing.start_date <= new.end_date
        //                         AND existing.end_date   >= new.start_date
        // If times are provided, also require time overlap on overlapping days.
        $conflict_sql = "SELECT id, reservation_title, start_date, end_date, start_time, end_time
                         FROM bookings
                         WHERE space_id = ?
                           AND status IN ('Approved','In Progress','Pending')
                           AND start_date <= ?
                           AND end_date   >= ?";
        $conflict_params = [$space_id, $end_date, $start_date];
        $conflict_types  = 'iss';

        if ($start_time && $end_time) {
            // Only count as a conflict when times overlap as well
            $conflict_sql .= " AND (start_time IS NULL OR end_time IS NULL
                               OR (start_time < ? AND end_time > ?))";
            $conflict_params[] = $end_time;
            $conflict_params[] = $start_time;
            $conflict_types   .= 'ss';
        }
        $conflict_sql .= " LIMIT 1";

        $conflict = queryOne($conflict_sql, $conflict_params, $conflict_types);
        if ($conflict) {
            jsonResponse(false,
                'Booking conflict with existing reservation "' . $conflict['reservation_title'] .
                '" (' . $conflict['start_date'] . ' to ' . $conflict['end_date'] . ')'
            );
        }

        // -------- Insert into new schema: reservation + space_reservation --------
        $conn = dbConnect();
        $event = trim($data['event_name']);
        $title = trim($data['reservation_title']);
        $apply_date = date('Y-m-d');
        $file_attach = $data['file_attachment'] ?? null;

        $stmt = $conn->prepare(
            "INSERT INTO reservation (user_id, event, reservation_title, no_participants,
                                      start_date, end_date, start_time, end_time, apply_date, file_attachment)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->bind_param('ississssss',
            $u['id'], $event, $title, $participants,
            $start_date, $end_date, $start_time, $end_time, $apply_date, $file_attach
        );
        if (!$stmt->execute()) {
            jsonResponse(false, 'Failed to submit booking: ' . $stmt->error);
        }
        $reservation_id = $conn->insert_id;
        $stmt->close();

        // Insert into space_reservation associative table
        $stmt = $conn->prepare(
            "INSERT INTO space_reservation (space_id, reservation_id, status) VALUES (?, ?, 'Pending')"
        );
        $stmt->bind_param('ii', $space_id, $reservation_id);
        if (!$stmt->execute()) {
            // Rollback reservation
            $conn->query("DELETE FROM reservation WHERE reservation_id = $reservation_id");
            jsonResponse(false, 'Failed to link space: ' . $stmt->error);
        }
        $stmt->close();

        jsonResponse(true, 'Booking submitted', ['booking_id' => $reservation_id]);
        break;

    // POST: cancel a booking the user owns
    case 'cancel_booking':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(false, 'POST required'); }
        $u = requireLogin();
        $data = readJsonBody();
        $booking_id = intval($data['booking_id'] ?? 0);
        if (!$booking_id) { jsonResponse(false, 'booking_id required'); }

        $conn = dbConnect();
        // Update space_reservation status (owns the status column now)
        $stmt = $conn->prepare(
            "UPDATE space_reservation sr
             JOIN reservation r ON r.reservation_id = sr.reservation_id
             SET sr.status='Cancelled', sr.approval_date=NOW()
             WHERE sr.reservation_id = ? AND r.user_id = ?
               AND sr.status IN ('Pending','Approved','In Progress')"
        );
        $stmt->bind_param('ii', $booking_id, $u['id']);
        $stmt->execute();
        if ($stmt->affected_rows < 1) {
            jsonResponse(false, 'Cannot cancel this booking');
        }
        jsonResponse(true, 'Booking cancelled');
        break;

    // POST: modify a pending booking (per SDP scope: reserve, modify, cancel)
    case 'modify_booking':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(false, 'POST required'); }
        $u = requireLogin();
        $data = readJsonBody();
        $booking_id = intval($data['booking_id'] ?? 0);
        if (!$booking_id) { jsonResponse(false, 'booking_id required'); }

        // Verify ownership and status = Pending
        $existing = queryOne(
            "SELECT r.reservation_id, r.user_id, sr.status
             FROM reservation r
             JOIN space_reservation sr ON sr.reservation_id = r.reservation_id
             WHERE r.reservation_id = ?", [$booking_id], 'i'
        );
        if (!$existing) jsonResponse(false, 'Booking not found');
        if ($existing['user_id'] != $u['id']) jsonResponse(false, 'Not your booking');
        if ($existing['status'] !== 'Pending') jsonResponse(false, 'Only Pending bookings can be modified');

        $conn = dbConnect();
        $updates = [];
        $values = [];
        $types = '';
        foreach (['event_name'=>'event','reservation_title'=>'reservation_title','start_date'=>'start_date',
                  'end_date'=>'end_date','start_time'=>'start_time','end_time'=>'end_time',
                  'total_participants'=>'no_participants'] as $in => $col) {
            if (isset($data[$in])) {
                $updates[] = "$col = ?";
                $values[] = $data[$in];
                $types .= ($col === 'no_participants') ? 'i' : 's';
            }
        }
        if (empty($updates)) jsonResponse(false, 'No fields to update');
        $values[] = $booking_id;
        $types .= 'i';

        $sql = "UPDATE reservation SET " . implode(',', $updates) . " WHERE reservation_id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$values);
        if ($stmt->execute()) {
            jsonResponse(true, 'Booking modified successfully');
        } else {
            jsonResponse(false, 'Failed to modify: ' . $stmt->error);
        }
        break;

    // GET: detail for one of the user's own bookings
    case 'get_booking_detail':
        $u = requireLogin();
        $booking_id = intval($_GET['booking_id'] ?? 0);
        if (!$booking_id) { jsonResponse(false, 'booking_id required'); }
        $row = queryOne(
            "SELECT b.*, s.space_name, s.space_code, s.category, s.campus, s.department,
                    s.operation_time, s.seating_capacity,
                    u.full_name AS applicant_name, u.student_no, u.email, u.phone
             FROM bookings b
             JOIN spaces s ON b.space_id = s.id
             JOIN users u  ON b.user_id  = u.id
             WHERE b.id = ? AND (b.user_id = ? OR ? IN ('Moderator','Admin'))",
            [$booking_id, $u['id'], $u['role']], 'iis'
        );
        if (!$row) { jsonResponse(false, 'Booking not found'); }
        jsonResponse(true, 'Success', $row);
        break;

    default:
        jsonResponse(false, 'Invalid action');
}
