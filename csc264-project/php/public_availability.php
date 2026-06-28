<?php
require_once 'db_config.php';

$date = $_GET['date'] ?? date('Y-m-d');
$time = $_GET['time'] ?? '';
$category = trim($_GET['category'] ?? '');

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    jsonResponse(false, 'Invalid date format. Use YYYY-MM-DD.');
}

if ($time && !preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $time)) {
    jsonResponse(false, 'Invalid time format. Use HH:MM.');
}

$startTime = '';
$endTime = '';

if ($time) {
    $startTime = strlen($time) === 5 ? $time . ':00' : $time;
    $end = DateTime::createFromFormat('H:i:s', $startTime);

    if (!$end) {
        jsonResponse(false, 'Invalid time value.');
    }

    $end->modify('+1 hour');
    $endTime = $end->format('H:i:s');
}

$where = 's.is_active = 1';
$params = [];
$types = '';

if ($category !== '') {
    $where .= ' AND s.category = ?';
    $params[] = $category;
    $types .= 's';
}

$timeClause = '';
$joinParams = [$date, $date];
$joinTypes = 'ss';

if ($startTime && $endTime) {
    $timeClause = ' AND (b.start_time IS NULL OR b.end_time IS NULL OR (b.start_time < ? AND b.end_time > ?))';
    $joinParams[] = $endTime;
    $joinParams[] = $startTime;
    $joinTypes .= 'ss';
}

$rows = queryAll(
    "SELECT s.id AS space_id, s.space_code, s.space_name, s.category, s.department,
            s.seating_capacity, s.hourly_rate,
            b.id AS booking_id, b.start_date, b.end_date, b.start_time, b.end_time, b.status
     FROM spaces s
     LEFT JOIN bookings b ON b.space_id = s.id
       AND b.status IN ('Pending', 'Approved', 'In Progress')
       AND b.start_date <= ? AND b.end_date >= ?
       $timeClause
     WHERE $where
     ORDER BY s.category, s.space_code, b.start_date, b.start_time",
    array_merge($joinParams, $params),
    $joinTypes . $types
);

$spaces = [];

foreach ($rows as $row) {
    $id = $row['space_id'];

    if (!isset($spaces[$id])) {
        $spaces[$id] = [
            'space_id' => intval($row['space_id']),
            'space_code' => $row['space_code'],
            'space_name' => $row['space_name'],
            'category' => $row['category'],
            'department' => $row['department'],
            'seating_capacity' => intval($row['seating_capacity'] ?? 0),
            'hourly_rate' => floatval($row['hourly_rate'] ?? 0),
            'status' => 'Available',
            'reservations' => [],
        ];
    }

    if ($row['booking_id']) {
        $spaces[$id]['reservations'][] = [
            'start_date' => $row['start_date'],
            'end_date' => $row['end_date'],
            'start_time' => $row['start_time'],
            'end_time' => $row['end_time'],
            'status' => $row['status'],
        ];

        if (in_array($row['status'], ['Approved', 'In Progress'], true)) {
            $spaces[$id]['status'] = 'Booked';
        } elseif ($spaces[$id]['status'] !== 'Booked') {
            $spaces[$id]['status'] = 'Pending';
        }
    }
}

$data = array_values($spaces);
$available = 0;
$booked = 0;
$pending = 0;

foreach ($data as $space) {
    if ($space['status'] === 'Available') $available++;
    elseif ($space['status'] === 'Pending') $pending++;
    else $booked++;
}

jsonResponse(true, 'Success', [
    'query' => [
        'date' => $date,
        'start_time' => $startTime,
        'end_time' => $endTime,
        'category' => $category,
    ],
    'summary' => [
        'total' => count($data),
        'available' => $available,
        'pending' => $pending,
        'booked' => $booked,
    ],
    'spaces' => $data,
]);
