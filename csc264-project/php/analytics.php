<?php
/**
 * =====================================================
 * ANALYTICS / REPORTS / CALCULATIONS
 * =====================================================
 *
 * Pure SQL aggregations used to power:
 *   - the admin Reports view (charts + ranked tables)
 *   - the student personal-stats panel on My Dashboard
 *   - the admin activity log viewer
 *
 * Endpoints:
 *   GET analytics.php?action=admin_overview
 *   GET analytics.php?action=space_utilization
 *   GET analytics.php?action=peak_hours
 *   GET analytics.php?action=monthly_trend
 *   GET analytics.php?action=top_applicants
 *   GET analytics.php?action=category_demand
 *   GET analytics.php?action=approval_breakdown
 *   GET analytics.php?action=activity_log&limit=50
 *   GET analytics.php?action=student_stats
 *   GET analytics.php?action=admin_rich_stats
 *   GET analytics.php?action=student_rich_stats
 */

require_once 'db_config.php';
require_once 'auth.php';

$action = $_GET['action'] ?? '';

/* ----- helpers ----- */

function pct($n, $d) {
    if ($d == 0) return 0;
    return round(($n / $d) * 100, 1);
}

/* Total scheduled minutes for a booking row. Falls back to 8 hours
   per day if start_time / end_time are NULL. */
function bookingMinutesSql() {
    return "(
        CASE
            WHEN start_time IS NOT NULL AND end_time IS NOT NULL THEN
                TIMESTAMPDIFF(MINUTE,
                    CONCAT(start_date,' ',start_time),
                    CONCAT(end_date,  ' ',end_time))
            ELSE
                (DATEDIFF(end_date, start_date) + 1) * 8 * 60
        END
    )";
}

switch ($action) {

    /* ============================================================
       1. ADMIN OVERVIEW - everything for the Reports landing
       ============================================================ */
    case 'admin_overview':
        requireRole(['Moderator','Admin']);

        // approval breakdown by status
        $statusRows = queryAll(
            "SELECT status, COUNT(*) AS c FROM space_reservation GROUP BY status",
            [], ''
        );
        $statusCounts = ['Pending'=>0,'Approved'=>0,'In Progress'=>0,'Rejected'=>0,'Cancelled'=>0];
        foreach ($statusRows as $r) { $statusCounts[$r['status']] = intval($r['c']); }
        $reviewed = $statusCounts['Approved'] + $statusCounts['Rejected'];
        $approval_rate = pct($statusCounts['Approved'], $reviewed);

        // category demand
        $byCategory = queryAll(
            "SELECT s.space_category AS category, COUNT(sr.reservation_id) AS c
             FROM space s
             LEFT JOIN space_reservation sr ON sr.space_id = s.space_id
             GROUP BY s.space_category
             ORDER BY c DESC",
            [], ''
        );

        // Booking trend — daily over the last 14 days. A short window with a
        // continuous (zero-filled) axis means the line is always visible, instead
        // of collapsing to a single point when all bookings are in one month.
        $trendRows = queryAll(
            "SELECT DATE(r.apply_date) AS d, COUNT(*) AS c
             FROM reservation r
             JOIN space_reservation sr ON sr.reservation_id = r.reservation_id
             WHERE r.apply_date >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
             GROUP BY d
             ORDER BY d",
            [], ''
        );
        $byDay = [];
        foreach ($trendRows as $row) { $byDay[$row['d']] = intval($row['c']); }
        $trend = [];
        for ($i = 13; $i >= 0; $i--) {
            $day = date('Y-m-d', strtotime("-$i day"));
            $trend[] = ['ym' => $day, 'label' => date('d M', strtotime($day)), 'c' => $byDay[$day] ?? 0];
        }

        // averages
        $avg = queryOne(
            "SELECT
                AVG(r.no_participants)             AS avg_participants,
                AVG(DATEDIFF(r.start_date, r.apply_date)) AS avg_lead_days,
                AVG(" . bookingMinutesSql() . ")  AS avg_minutes
             FROM reservation r
             JOIN space_reservation sr ON sr.reservation_id = r.reservation_id
             WHERE sr.status IN ('Approved','In Progress')",
            [], ''
        ) ?: [];

        jsonResponse(true, 'Success', [
            'status_counts'    => $statusCounts,
            'approval_rate'    => $approval_rate,
            'reviewed_total'   => $reviewed,
            'by_category'      => $byCategory,
            'monthly_trend'    => $trend,
            'avg_participants' => round(floatval($avg['avg_participants'] ?? 0), 1),
            'avg_lead_days'    => round(floatval($avg['avg_lead_days']    ?? 0), 1),
            'avg_hours'        => round(floatval($avg['avg_minutes']      ?? 0) / 60, 1),
        ]);
        break;

    /* ============================================================
       2. SPACE UTILIZATION - top + bottom ranked
       ============================================================ */
    case 'space_utilization':
        requireRole(['Moderator','Admin']);

        // Period: last 30 days by default
        $days = max(1, intval($_GET['days'] ?? 30));
        $available_minutes_per_day = 10 * 60;   // assume 10 op-hours/day
        $period_minutes = $days * $available_minutes_per_day;

        $rows = queryAll(
            "SELECT s.id, s.space_code, s.space_name, s.category, s.seating_capacity,
                    COUNT(b.id) AS booking_count,
                    COALESCE(SUM(" . bookingMinutesSql() . "), 0) AS used_minutes
             FROM spaces s
             LEFT JOIN bookings b
               ON b.space_id = s.id
              AND b.status IN ('Approved','In Progress')
              AND b.start_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
             WHERE s.is_active = 1
             GROUP BY s.id
             ORDER BY used_minutes DESC",
            [$days], 'i'
        );

        foreach ($rows as &$r) {
            $r['used_hours']       = round($r['used_minutes'] / 60, 1);
            $r['utilization_pct']  = pct($r['used_minutes'], $period_minutes);
            $r['booking_count']    = intval($r['booking_count']);
            unset($r['used_minutes']);
        }
        unset($r);

        jsonResponse(true, 'Success', [
            'days'      => $days,
            'top_5'     => array_slice($rows, 0, 5),
            'bottom_5'  => array_slice(array_reverse($rows), 0, 5),
            'all'       => $rows,
        ]);
        break;

    /* ============================================================
       3. PEAK HOURS - histogram of bookings by start hour
       ============================================================ */
    case 'peak_hours':
        requireRole(['Moderator','Admin']);
        $rows = queryAll(
            "SELECT HOUR(r.start_time) AS h, COUNT(*) AS c
             FROM reservation r
             JOIN space_reservation sr ON sr.reservation_id = r.reservation_id
             WHERE r.start_time IS NOT NULL
               AND sr.status IN ('Approved','In Progress','Pending')
             GROUP BY h
             ORDER BY h",
            [], ''
        );
        // Fill 0..23 with zeros where missing
        $hist = array_fill(0, 24, 0);
        foreach ($rows as $r) { $hist[intval($r['h'])] = intval($r['c']); }
        jsonResponse(true, 'Success', $hist);
        break;

    /* ============================================================
       4. TOP APPLICANTS - users ranked by booking count
       ============================================================ */
    case 'top_applicants':
        requireRole(['Moderator','Admin']);
        $rows = queryAll(
            "SELECT u.user_id AS id, u.name AS full_name, u.email, s.faculty,
                    COUNT(r.reservation_id)                  AS booking_count,
                    COALESCE(SUM(r.no_participants), 0) AS total_participants,
                    SUM(CASE WHEN sr.status='Approved' THEN 1 ELSE 0 END) AS approved_count
             FROM user u
             LEFT JOIN reservation r ON r.user_id = u.user_id
             LEFT JOIN space_reservation sr ON sr.reservation_id = r.reservation_id
             LEFT JOIN student s ON s.user_id = u.user_id
             WHERE u.user_category = 'Student'
             GROUP BY u.user_id
             HAVING booking_count > 0
             ORDER BY booking_count DESC, total_participants DESC
             LIMIT 10",
            [], ''
        );
        jsonResponse(true, 'Success', $rows);
        break;

    /* ============================================================
       5. ACTIVITY LOG VIEWER (admin_logs table)
       ============================================================ */
    case 'activity_log':
        requireRole(['Moderator','Admin']);
        $limit = max(1, min(200, intval($_GET['limit'] ?? 50)));
        $rows = queryAll(
            "SELECT al.log_id AS id, al.action, al.target_table, al.target_id,
                    al.details, al.created_at,
                    u.full_name AS admin_name, u.role AS admin_role
             FROM admin_logs al
             JOIN users u ON al.admin_id = u.id
             ORDER BY al.created_at DESC
             LIMIT $limit",
            [], ''
        );
        // Decode JSON details for the frontend
        foreach ($rows as &$r) {
            $r['details_decoded'] = $r['details'] ? json_decode($r['details'], true) : null;
        }
        unset($r);
        jsonResponse(true, 'Success', $rows);
        break;

    /* ============================================================
       6. STUDENT PERSONAL STATS - per-user calculations
       ============================================================ */
    case 'student_stats':
        $u = requireLogin();

        // Counts by status
        $byStatus = queryAll(
            "SELECT sr.status, COUNT(*) AS c FROM space_reservation sr
             JOIN reservation r ON sr.reservation_id = r.reservation_id
             WHERE r.user_id = ? GROUP BY sr.status",
            [$u['id']], 'i'
        );
        $counts = ['Pending'=>0,'Approved'=>0,'In Progress'=>0,'Rejected'=>0,'Cancelled'=>0];
        foreach ($byStatus as $r) { $counts[$r['status']] = intval($r['c']); }

        $reviewed = $counts['Approved'] + $counts['Rejected'];
        $approval_rate = pct($counts['Approved'], $reviewed);

        $sums = queryOne(
            "SELECT
                COUNT(*)                                  AS total,
                COALESCE(SUM(r.no_participants), 0)      AS total_participants,
                COALESCE(SUM(" . bookingMinutesSql() . "), 0)
                                                          AS total_minutes,
                COALESCE(AVG(DATEDIFF(r.start_date, r.apply_date)), 0)
                                                          AS avg_lead
             FROM reservation r
             JOIN space_reservation sr ON sr.reservation_id = r.reservation_id
             WHERE r.user_id = ? AND sr.status IN ('Approved','In Progress')",
            [$u['id']], 'i'
        ) ?: [];

        // Capacity usage averaged across user's bookings
        $cap = queryOne(
            "SELECT AVG(r.no_participants / NULLIF(s.seating_capacity,0)) AS avg_ratio
             FROM reservation r
             JOIN space_reservation sr ON sr.reservation_id = r.reservation_id
             JOIN space s ON sr.space_id = s.space_id
             WHERE r.user_id = ?
               AND sr.status IN ('Approved','In Progress')
               AND s.seating_capacity > 0",
            [$u['id']], 'i'
        ) ?: [];

        // Favorite category
        $fav = queryOne(
            "SELECT s.space_category AS category, COUNT(*) AS c
             FROM reservation r
             JOIN space_reservation sr ON sr.reservation_id = r.reservation_id
             JOIN space s ON sr.space_id = s.space_id
             WHERE r.user_id = ?
             GROUP BY s.space_category
             ORDER BY c DESC
             LIMIT 1",
            [$u['id']], 'i'
        ) ?: ['category' => '—', 'c' => 0];

        jsonResponse(true, 'Success', [
            'status_counts'        => $counts,
            'approval_rate'        => $approval_rate,
            'reviewed_total'       => $reviewed,
            'total_bookings'       => intval($sums['total']),
            'total_hours'          => round(floatval($sums['total_minutes']) / 60, 1),
            'total_participants'   => intval($sums['total_participants']),
            'avg_lead_days'        => round(floatval($sums['avg_lead']), 1),
            'avg_capacity_usage'   => round(floatval($cap['avg_ratio'] ?? 0) * 100, 1),
            'favorite_category'    => $fav['category'],
        ]);
        break;

    /* ============================================================
       7. RICH STAT CARDS - both admin and student
       ============================================================ */
    case 'admin_rich_stats':
        requireRole(['Moderator','Admin']);
        $today = date('Y-m-d');
        $week_ago = date('Y-m-d', strtotime('-7 days'));

        $pending   = intval(queryOne("SELECT COUNT(*) c FROM space_reservation WHERE status='Pending'", [], '')['c']);
        $approved  = intval(queryOne("SELECT COUNT(*) c FROM space_reservation WHERE status='Approved'", [], '')['c']);
        $spaces    = intval(queryOne("SELECT COUNT(*) c FROM space WHERE is_active=1", [], '')['c']);
        $thisWeek  = intval(queryOne(
            "SELECT COUNT(*) c FROM reservation WHERE apply_date >= ?",
            [$week_ago], 's'
        )['c']);
        $hoursWeek = floatval(queryOne(
            "SELECT COALESCE(SUM(" . bookingMinutesSql() . "),0)/60 AS h
             FROM reservation r
             JOIN space_reservation sr ON sr.reservation_id = r.reservation_id
             WHERE sr.status IN ('Approved','In Progress')
               AND r.start_date >= ?",
            [$week_ago], 's'
        )['h']);
        $partsActive = intval(queryOne(
            "SELECT COALESCE(SUM(r.no_participants),0) c
             FROM reservation r
             JOIN space_reservation sr ON sr.reservation_id = r.reservation_id
             WHERE sr.status IN ('Approved','In Progress')",
            [], ''
        )['c']);

        jsonResponse(true, 'Success', [
            'pending'             => $pending,
            'approved'            => $approved,
            'spaces'              => $spaces,
            'this_week_bookings'  => $thisWeek,
            'hours_scheduled_7d'  => round($hoursWeek, 1),
            'active_participants' => $partsActive,
        ]);
        break;

    case 'student_rich_stats':
        $u = requireLogin();
        $week_ahead = date('Y-m-d', strtotime('+7 days'));

        $total_spaces  = intval(queryOne("SELECT COUNT(*) c FROM space WHERE is_active = 1", [], '')['c']);
        // A booking only counts as "active" while it hasn't finished yet. Once its
        // end (end_date + end_time, or end of day when no time) is in the past, it
        // has expired and drops out of the active count. NULL end_time → 23:59:59.
        $notExpired = "TIMESTAMP(r.end_date, COALESCE(r.end_time, '23:59:59')) >= NOW()";
        $active = intval(queryOne(
            "SELECT COUNT(*) c FROM space_reservation sr
             JOIN reservation r ON sr.reservation_id = r.reservation_id
             WHERE r.user_id=? AND sr.status='Approved' AND $notExpired",
            [$u['id']], 'i'
        )['c']);
        $pending = intval(queryOne(
            "SELECT COUNT(*) c FROM space_reservation sr
             JOIN reservation r ON sr.reservation_id = r.reservation_id
             WHERE r.user_id=? AND sr.status='Pending'",
            [$u['id']], 'i'
        )['c']);
        $partsActive = intval(queryOne(
            "SELECT COALESCE(SUM(r.no_participants),0) c
             FROM reservation r
             JOIN space_reservation sr ON sr.reservation_id = r.reservation_id
             WHERE r.user_id=? AND sr.status='Approved' AND $notExpired",
            [$u['id']], 'i'
        )['c']);
        $hoursActive = floatval(queryOne(
            "SELECT COALESCE(SUM(" . bookingMinutesSql() . "),0)/60 AS h
             FROM reservation r
             JOIN space_reservation sr ON sr.reservation_id = r.reservation_id
             WHERE r.user_id = ? AND sr.status IN ('Approved','In Progress')",
            [$u['id']], 'i'
        )['h']);
        $upcoming = intval(queryOne(
            "SELECT COUNT(*) c FROM reservation r
             JOIN space_reservation sr ON sr.reservation_id = r.reservation_id
             WHERE r.user_id=? AND sr.status='Approved'
               AND r.start_date BETWEEN CURDATE() AND ?",
            [$u['id'], $week_ahead], 'is'
        )['c']);

        jsonResponse(true, 'Success', [
            'total_spaces'        => $total_spaces,
            'active_bookings'     => $active,
            'pending_count'       => $pending,
            'total_participants'  => $partsActive,
            'hours_scheduled'     => round($hoursActive, 1),
            'upcoming_7d'         => $upcoming,
        ]);
        break;

    /* ============================================================
       SDP REPORT 1: BOOKING SUMMARY REPORT
       ============================================================ */
    case 'booking_summary_report':
        requireRole(['Moderator','Admin']);
        $start = $_GET['start'] ?? date('Y-m-d', strtotime('-90 days'));
        $end = $_GET['end'] ?? date('Y-m-d', strtotime('+90 days'));

        $rows = queryAll(
            "SELECT r.reservation_id AS id, r.event AS event_name, r.reservation_title,
                    r.start_date, r.end_date, r.apply_date AS applied_date,
                    r.no_participants AS participants,
                    sr.status, sr.approval_date,
                    u.name AS applicant, s.space_code, s.space_name
             FROM reservation r
             JOIN space_reservation sr ON sr.reservation_id = r.reservation_id
             JOIN `user` u ON u.user_id = r.user_id
             JOIN space s ON s.space_id = sr.space_id
             WHERE r.start_date BETWEEN ? AND ?
             ORDER BY r.apply_date DESC",
            [$start, $end], 'ss'
        );

        // Status totals
        $totals = ['Pending'=>0,'Approved'=>0,'In Progress'=>0,'Rejected'=>0,'Cancelled'=>0];
        foreach ($rows as $r) { $totals[$r['status']] = ($totals[$r['status']] ?? 0) + 1; }

        jsonResponse(true, 'Success', [
            'period' => ['start' => $start, 'end' => $end],
            'totals' => $totals,
            'total_count' => count($rows),
            'bookings' => $rows,
        ]);
        break;

    /* ============================================================
       SDP REPORT 2: USER BOOKING HISTORY REPORT
       ============================================================ */
    case 'user_history_report':
        requireRole(['Moderator','Admin']);
        $search = trim($_GET['search'] ?? '');
        $user_id = intval($_GET['user_id'] ?? 0);

        if (!$user_id && !$search) {
            // Return list of users to select from
            $users = queryAll(
                "SELECT u.user_id AS id, u.name AS full_name, u.email,
                        COALESCE(s.student_no, st.staff_no) AS identifier,
                        u.user_category
                 FROM `user` u
                 LEFT JOIN student s ON s.user_id = u.user_id
                 LEFT JOIN staff st ON st.user_id = u.user_id
                 WHERE u.status = 'Active'
                 ORDER BY u.name", [], ''
            );
            jsonResponse(true, 'User list', ['user_list' => $users]);
        }

        if ($search && !$user_id) {
            $like = "%$search%";
            $u = queryOne(
                "SELECT u.user_id AS id, u.name, u.email
                 FROM `user` u
                 LEFT JOIN student s ON s.user_id = u.user_id
                 LEFT JOIN staff st ON st.user_id = u.user_id
                 WHERE u.name LIKE ? OR u.email LIKE ? OR s.student_no LIKE ? OR st.staff_no LIKE ?
                 LIMIT 1", [$like, $like, $like, $like], 'ssss'
            );
            if (!$u) jsonResponse(false, 'User not found');
            $user_id = $u['id'];
        }

        $user_info = queryOne(
            "SELECT u.user_id AS id, u.name AS full_name, u.email, u.contact_no AS phone,
                    u.user_category, u.campus,
                    COALESCE(s.student_no, st.staff_no) AS identifier,
                    s.department, s.program
             FROM `user` u
             LEFT JOIN student s ON s.user_id = u.user_id
             LEFT JOIN staff st ON st.user_id = u.user_id
             WHERE u.user_id = ?", [$user_id], 'i'
        );

        $rows = queryAll(
            "SELECT r.reservation_id AS id, r.event AS event_name, r.reservation_title,
                    r.start_date, r.end_date, r.start_time, r.end_time,
                    r.apply_date AS applied_date, r.no_participants AS participants,
                    sr.status, sr.approval_date, sr.review_notes,
                    s.space_code, s.space_name, s.space_category AS category
             FROM reservation r
             JOIN space_reservation sr ON sr.reservation_id = r.reservation_id
             JOIN space s ON s.space_id = sr.space_id
             WHERE r.user_id = ?
             ORDER BY r.apply_date DESC", [$user_id], 'i'
        );

        jsonResponse(true, 'Success', [
            'user' => $user_info,
            'total_bookings' => count($rows),
            'bookings' => $rows,
        ]);
        break;

    /* ============================================================
       SDP REPORT 3: ROOM UTILIZATION REPORT
       ============================================================ */
    case 'room_utilization_report':
        requireRole(['Moderator','Admin']);
        $days = max(1, intval($_GET['days'] ?? 30));
        $available_minutes_per_day = 10 * 60;
        $period_minutes = $days * $available_minutes_per_day;

        $rows = queryAll(
            "SELECT s.space_id AS id, s.space_code, s.space_name, s.space_category AS category,
                    s.seating_capacity,
                    COUNT(sr.reservation_id) AS booking_count,
                    SUM(CASE WHEN sr.status='Approved' OR sr.status='In Progress' THEN 1 ELSE 0 END) AS approved_count,
                    COALESCE(SUM(CASE
                        WHEN sr.status IN ('Approved','In Progress') THEN " . bookingMinutesSql() . "
                        ELSE 0
                    END), 0) AS used_minutes
             FROM space s
             LEFT JOIN space_reservation sr ON sr.space_id = s.space_id
             LEFT JOIN reservation r ON r.reservation_id = sr.reservation_id
                AND r.start_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
             WHERE s.is_active = 1
             GROUP BY s.space_id
             ORDER BY used_minutes DESC", [$days], 'i'
        );

        foreach ($rows as &$r) {
            $r['used_hours'] = round($r['used_minutes'] / 60, 1);
            $r['utilization_pct'] = pct($r['used_minutes'], $period_minutes);
            $r['booking_count'] = intval($r['booking_count']);
            $r['approved_count'] = intval($r['approved_count']);
            unset($r['used_minutes']);
        }
        unset($r);

        jsonResponse(true, 'Success', [
            'period_days' => $days,
            'available_hours_per_room' => round($period_minutes / 60, 1),
            'rooms' => $rows,
        ]);
        break;

    default:
        jsonResponse(false, 'Invalid action');
}
