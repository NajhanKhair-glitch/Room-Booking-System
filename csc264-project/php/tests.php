<?php
/**
 * =====================================================
 * SMOKE TEST RUNNER
 * =====================================================
 *
 * Open in browser:
 *   http://localhost/csc264-project/php/tests.php
 *
 * Runs a series of pass/fail assertions against the database
 * and PHP helpers WITHOUT requiring a login or going over HTTP.
 * Use this to verify the system is wired correctly after setup.
 *
 * For HTTP-level tests of the JSON endpoints, see the second
 * section ("API Endpoint Tests").
 */

require_once 'db_config.php';

$results = [];

/**
 * Record a single assertion in $results.
 *
 *   t('what is being checked', $someCondition, 'helpful extra detail');
 */
function t($name, $condition, $info = '') {
    global $results;
    $results[] = [
        'name' => $name,
        'pass' => (bool) $condition,
        'info' => $info,
    ];
}

/* ============================================================
   1) DATABASE-LEVEL TESTS
   ============================================================ */
$conn = getDBConnection();
t('DB connection works', $conn instanceof mysqli && !$conn->connect_error);

$tables = ['users', 'spaces', 'bookings', 'space_moderators', 'admin_logs'];
foreach ($tables as $tbl) {
    t("Table `$tbl` exists", tableExists($conn, $tbl));
}

$seed_users = getOneResult($conn, "SELECT COUNT(*) c FROM users WHERE role IN ('Admin','Moderator','Student')");
t('At least 1 seed user present', intval($seed_users['c']) > 0, $seed_users['c'] . ' rows');

$seed_spaces = getOneResult($conn, "SELECT COUNT(*) c FROM spaces");
t('At least 1 seed space present', intval($seed_spaces['c']) > 0, $seed_spaces['c'] . ' rows');

$placeholders = getOneResult($conn,
    "SELECT COUNT(*) c FROM users WHERE password = '\$2y\$10\$placeholder'");
t('Passwords have been hashed (setup.php was run)',
    intval($placeholders['c']) === 0,
    intval($placeholders['c']) > 0
        ? 'Still ' . $placeholders['c'] . ' placeholder hashes — run setup.php'
        : 'all good');

/* ============================================================
   2) BOOKING CONFLICT-DETECTION LOGIC TEST
   ============================================================
   Insert a temporary booking, attempt an overlapping one via the
   same SQL the user_bookings.php endpoint uses, then clean up.
*/
$student = getOneResult($conn, "SELECT id FROM users WHERE role='Student' LIMIT 1");
$space   = getOneResult($conn, "SELECT id FROM spaces WHERE is_active=1 LIMIT 1");

if ($student && $space) {
    $tomorrow = date('Y-m-d', strtotime('+1 day'));
    $insert = $conn->prepare("INSERT INTO bookings
        (user_id, space_id, reservation_title, event_name,
         start_date, end_date, start_time, end_time,
         applied_date, total_participants, status)
        VALUES (?, ?, '__TEST__', '__TEST__', ?, ?, '10:00:00','12:00:00', CURDATE(), 5, 'Approved')");
    $insert->bind_param('iiss', $student['id'], $space['id'], $tomorrow, $tomorrow);
    $insert->execute();
    $test_id = $conn->insert_id;
    t('Test booking inserted', $test_id > 0);

    $clash = getOneResult($conn,
        "SELECT id FROM bookings
         WHERE space_id = ? AND status IN ('Pending','Approved','In Progress')
           AND start_date <= ? AND end_date >= ?
           AND start_time < ? AND end_time > ?",
        [$space['id'], $tomorrow, $tomorrow, '11:30:00', '10:30:00'], 'issss'
    );
    t('Conflict detection finds an overlap', !empty($clash), $clash ? 'overlap matched id ' . $clash['id'] : '');

    $no_clash = getOneResult($conn,
        "SELECT id FROM bookings
         WHERE space_id = ? AND status IN ('Pending','Approved','In Progress')
           AND start_date <= ? AND end_date >= ?
           AND start_time < ? AND end_time > ?
           AND id <> ?",
        [$space['id'], $tomorrow, $tomorrow, '16:00:00', '14:00:00', $test_id], 'issssi'
    );
    t('Conflict detection ignores non-overlap', empty($no_clash));

    $conn->query("DELETE FROM bookings WHERE id = $test_id");
} else {
    t('Conflict detection prerequisites', false, 'Need at least one Student and one active Space');
}

/* ============================================================
   3) PASSWORD HASH ROUND-TRIP
   ============================================================ */
$h = password_hash('hello', PASSWORD_DEFAULT);
t('password_hash() / password_verify() round-trip',
    password_verify('hello', $h) && !password_verify('nope', $h));

/* ============================================================
   4) API ENDPOINT TESTS (lightweight HTTP)
   ============================================================ */

function hit($path) {
    $url = 'http://localhost/csc264-project/php/' . $path;
    $ch  = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 5,
        CURLOPT_FOLLOWLOCATION => false,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'body' => $body, 'json' => json_decode($body, true)];
}

$apiTestsAvailable = function_exists('curl_init');
t('cURL is available', $apiTestsAvailable, $apiTestsAvailable ? '' : 'enable the curl PHP extension to run API tests');

if ($apiTestsAvailable) {
    $r = hit('user_bookings.php?action=get_my_bookings');
    t('Unauthenticated request to a protected endpoint returns 401',
        $r['code'] === 401 && isset($r['json']['success']) && $r['json']['success'] === false,
        'got HTTP ' . $r['code']);

    $r = hit('auth.php?action=session');
    t('auth.php?action=session responds with JSON',
        is_array($r['json']) && array_key_exists('success', $r['json']),
        'success=' . ($r['json']['success'] ?? 'n/a'));

    $r = hit('user_bookings.php?action=does_not_exist');
    t('Unknown action returns success=false',
        isset($r['json']['success']) && $r['json']['success'] === false,
        'message=' . ($r['json']['message'] ?? ''));
}

$passed = count(array_filter($results, fn($r) => $r['pass']));
$total  = count($results);
$status = $passed === $total ? 'OK' : 'FAILED';
?>
<!doctype html>
<html>
<head>
    <meta charset="UTF-8">
    <title>BSU Smoke Tests</title>
    <link rel="stylesheet" href="../css/tests_styles.css">
</head>
<body>
<h1>🧪 BSU Smoke Tests</h1>
<p style="color:#6B7280;">Quick assertion suite for the BSU Space Booking System. Run after setup; re-run after schema changes.</p>

<div class="summary <?= $passed === $total ? 'ok' : 'fail' ?>">
    <?= $status ?> &middot; <?= $passed ?> / <?= $total ?> tests passed
</div>

<table>
    <thead><tr><th style="width:80px;">Result</th><th>Test</th><th>Detail</th></tr></thead>
    <tbody>
    <?php foreach ($results as $r): ?>
        <tr>
            <td><span class="<?= $r['pass'] ? 'pass' : 'fail' ?>">
                <?= $r['pass'] ? '✓ PASS' : '✗ FAIL' ?>
            </span></td>
            <td><?= htmlspecialchars($r['name']) ?></td>
            <td class="info"><?= htmlspecialchars($r['info']) ?></td>
        </tr>
    <?php endforeach; ?>
    </tbody>
</table>

<div class="note">
    <strong>About these tests:</strong> this is a smoke-test harness for course demo purposes — not a substitute
    for a real unit-test framework. It checks: (1) DB connection &amp; schema, (2) seed data presence, (3) the
    SQL underlying the booking conflict detector, (4) password hashing round-trip, (5) that protected JSON
    endpoints actually reject unauthenticated requests with HTTP 401. Add more <code>t(...)</code> calls above
    to cover anything else you care about.
</div>
</body>
</html>
