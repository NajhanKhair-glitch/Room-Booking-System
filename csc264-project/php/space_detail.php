<?php
/**
 * =====================================================
 * SPACE DETAIL ENDPOINT
 * -----------------------------------------------------
 *   GET  space_detail.php?action=get&space_id=X
 *   GET  space_detail.php?action=week_schedule&space_id=X&week_start=YYYY-MM-DD
 * =====================================================
 */
require_once 'db_config.php';
require_once 'auth.php';

requireLogin();
$action = $_GET['action'] ?? '';

switch ($action) {

    case 'get':
        $space_id = intval($_GET['space_id'] ?? 0);
        if (!$space_id) jsonResponse(false, 'space_id required');
        $row = queryOne(
            "SELECT id, space_code, space_name, category, campus, department,
                    operation_time, seating_capacity,
                    hourly_rate, rate_4hour, rate_full_day,
                    facilities_list, remark, additional_info, terms_conditions,
                    image_url, moderator_names, person_incharge, is_active
             FROM spaces WHERE id = ?",
            [$space_id], 'i'
        );
        if (!$row) jsonResponse(false, 'Space not found');
        jsonResponse(true, 'Success', $row);
        break;

    case 'week_schedule':
        $space_id   = intval($_GET['space_id']   ?? 0);
        $week_start = $_GET['week_start']        ?? date('Y-m-d');
        if (!$space_id) jsonResponse(false, 'space_id required');

        $start_ts = strtotime($week_start);
        if ($start_ts === false) jsonResponse(false, 'Invalid week_start');
        $start = date('Y-m-d', $start_ts);
        $end   = date('Y-m-d', $start_ts + 6 * 86400);

        $rows = queryAll(
            "SELECT b.id, b.reservation_title, b.start_date, b.end_date,
                    b.start_time, b.end_time, b.status,
                    u.full_name AS applicant_name
             FROM bookings b
             JOIN users u ON b.user_id = u.id
             WHERE b.space_id = ?
               AND b.status IN ('Approved','In Progress','Pending')
               AND b.start_date <= ?
               AND b.end_date   >= ?
             ORDER BY b.start_date, b.start_time",
            [$space_id, $end, $start], 'iss'
        );

        // Build occupancy map: day_index (0=Mon..6=Sun) → list of slots
        $week = [];
        for ($i = 0; $i < 7; $i++) {
            $week[$i] = [
                'date'      => date('Y-m-d', $start_ts + $i * 86400),
                'day_name'  => date('l', $start_ts + $i * 86400),
                'reserved'  => [],
            ];
        }
        foreach ($rows as $r) {
            $s_ts = max($start_ts, strtotime($r['start_date']));
            $e_ts = min($start_ts + 6 * 86400, strtotime($r['end_date']));
            for ($t = $s_ts; $t <= $e_ts; $t += 86400) {
                $idx = intval(round(($t - $start_ts) / 86400));
                if ($idx < 0 || $idx > 6) continue;
                $week[$idx]['reserved'][] = [
                    'title'       => $r['reservation_title'],
                    'start_time'  => $r['start_time'] ?? '08:00:00',
                    'end_time'    => $r['end_time']   ?? '18:00:00',
                    'status'      => $r['status'],
                    'applicant'   => $r['applicant_name'],
                ];
            }
        }
        jsonResponse(true, 'Success', [
            'week_start' => $start,
            'week_end'   => $end,
            'days'       => array_values($week),
        ]);
        break;

    default:
        jsonResponse(false, 'Invalid action');
}
