<?php
require_once 'db_config.php';
require_once 'auth.php';

requireLogin();

$action = $_GET['action'] ?? '';

switch ($action) {

    // GET: all active spaces (optionally filtered by category)
    case 'get_spaces':
        $category = $_GET['category'] ?? '';
        if ($category) {
            $rows = queryAll(
                "SELECT id, space_code, space_name, category, campus, department,
                        operation_time, seating_capacity, moderator_names, person_incharge,
                        image_url, hourly_rate
                 FROM spaces WHERE is_active = 1 AND category = ?
                 ORDER BY space_name",
                [$category], 's'
            );
        } else {
            $rows = queryAll(
                "SELECT id, space_code, space_name, category, campus, department,
                        operation_time, seating_capacity, moderator_names, person_incharge,
                        image_url, hourly_rate
                 FROM spaces WHERE is_active = 1
                 ORDER BY category, space_name",
                [], ''
            );
        }
        jsonResponse(true, 'Success', $rows);
        break;

    // GET: all distinct categories
    case 'get_categories':
        $rows = queryAll(
            "SELECT DISTINCT category FROM spaces WHERE is_active = 1 ORDER BY category",
            [], ''
        );
        $categories = array_column($rows, 'category');
        jsonResponse(true, 'Success', $categories);
        break;

    // GET: space names for a specific category (for dropdown)
    case 'get_space_names':
        $category = $_GET['category'] ?? '';
        if (!$category) { jsonResponse(false, 'category required'); }
        $rows = queryAll(
            "SELECT id, space_code, space_name, hourly_rate, seating_capacity FROM spaces
             WHERE is_active = 1 AND category = ?
             ORDER BY space_name",
            [$category], 's'
        );
        jsonResponse(true, 'Success', $rows);
        break;

    // GET: space availability / schedule between dates
    case 'get_schedule':
        $space_id  = intval($_GET['space_id'] ?? 0);
        $start_date = $_GET['start_date'] ?? '';
        $end_date   = $_GET['end_date']   ?? '';
        if (!$space_id || !$start_date || !$end_date) {
            jsonResponse(false, 'space_id, start_date, end_date required');
        }
        $rows = queryAll(
            "SELECT b.id, b.reservation_title AS title, b.event_name,
                    b.start_date, b.end_date, b.start_time, b.end_time,
                    b.total_participants, b.status,
                    u.full_name AS applicant_name,
                    s.space_code, s.space_name
             FROM bookings b
             JOIN users u ON b.user_id = u.id
             JOIN spaces s ON b.space_id = s.id
             WHERE b.space_id = ?
               AND b.start_date <= ? AND b.end_date >= ?
               AND b.status IN ('Approved','In Progress')
             ORDER BY b.start_date, b.start_time",
            [$space_id, $end_date, $start_date], 'iss'
        );
        jsonResponse(true, 'Success', $rows);
        break;

    // GET: search schedule by category + space name + date range (for schedule module)
    case 'search_schedule':
        $category   = $_GET['category']   ?? '';
        $space_name = $_GET['space_name'] ?? '';
        $start_date = $_GET['start_date'] ?? '';
        $end_date   = $_GET['end_date']   ?? '';
        $department = $_GET['department'] ?? '';

        $where  = "s.is_active = 1";
        $params = [];
        $types  = '';

        if ($category) {
            $where .= " AND s.category = ?";
            $params[] = $category;
            $types   .= 's';
        }
        if ($space_name) {
            $where .= " AND s.space_name = ?";
            $params[] = $space_name;
            $types   .= 's';
        }
        if ($department) {
            $where .= " AND s.department = ?";
            $params[] = $department;
            $types   .= 's';
        }

        $rows = queryAll(
            "SELECT s.id AS space_id, s.space_code, s.space_name, s.category, s.department,
                    b.id AS booking_id, b.reservation_title, b.start_date, b.end_date,
                    b.start_time, b.end_time, b.total_participants, b.status,
                    u.full_name AS applicant_name
             FROM spaces s
             LEFT JOIN bookings b ON b.space_id = s.id
               AND b.status IN ('Approved','In Progress')
               AND (? = '' OR (b.start_date <= ? AND b.end_date >= ?))
             LEFT JOIN users u ON b.user_id = u.id
             WHERE $where
             ORDER BY s.space_code, b.start_date",
            array_merge([$start_date, $end_date, $start_date], $params),
            'sss' . $types
        );

        // Group by space
        $grouped = [];
        foreach ($rows as $r) {
            $key = $r['space_id'];
            if (!isset($grouped[$key])) {
                $grouped[$key] = [
                    'space_id'    => $r['space_id'],
                    'space_code'  => $r['space_code'],
                    'space_name'  => $r['space_name'],
                    'category'    => $r['category'],
                    'department'  => $r['department'],
                    'reservations'=> [],
                ];
            }
            if ($r['booking_id']) {
                $grouped[$key]['reservations'][] = [
                    'booking_id'        => $r['booking_id'],
                    'title'             => $r['reservation_title'],
                    'start_date'        => $r['start_date'],
                    'end_date'          => $r['end_date'],
                    'start_time'        => $r['start_time'],
                    'end_time'          => $r['end_time'],
                    'applicant_name'    => $r['applicant_name'],
                    'total_participants'=> $r['total_participants'],
                    'status'            => $r['status'],
                ];
            }
        }
        jsonResponse(true, 'Success', array_values($grouped));
        break;

    // GET: real-time conflict preview for the booking form
    // Returns existing reservations that would overlap with the proposed slot,
    // so the student sees the clash BEFORE submitting.
    case 'clash_preview':
        $space_id   = intval($_GET['space_id']   ?? 0);
        $start_date = $_GET['start_date'] ?? '';
        $end_date   = $_GET['end_date']   ?? '';
        $start_time = $_GET['start_time'] ?? '';
        $end_time   = $_GET['end_time']   ?? '';
        if (!$space_id || !$start_date || !$end_date) {
            jsonResponse(false, 'space_id, start_date, end_date required');
        }

        $sql = "SELECT b.id, b.reservation_title, b.start_date, b.end_date,
                       b.start_time, b.end_time, b.status,
                       u.full_name AS applicant_name
                FROM bookings b
                JOIN users u ON b.user_id = u.id
                WHERE b.space_id = ?
                  AND b.status IN ('Approved','In Progress','Pending')
                  AND b.start_date <= ? AND b.end_date >= ?";
        $params = [$space_id, $end_date, $start_date];
        $types  = 'iss';

        if ($start_time && $end_time) {
            $sql .= " AND (b.start_time IS NULL OR b.end_time IS NULL
                       OR (b.start_time < ? AND b.end_time > ?))";
            $params[] = $end_time;
            $params[] = $start_time;
            $types   .= 'ss';
        }
        $sql .= " ORDER BY b.start_date, b.start_time";

        $rows = queryAll($sql, $params, $types);
        jsonResponse(true, 'Success', [
            'has_clash'    => count($rows) > 0,
            'reservations' => $rows,
        ]);
        break;

    default:
        jsonResponse(false, 'Invalid action');
}
