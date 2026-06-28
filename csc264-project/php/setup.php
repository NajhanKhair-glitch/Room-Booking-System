<?php
/**
 * =====================================================
 * ONE-TIME SETUP SCRIPT
 * =====================================================
 *
 * The SQL seed inserts users with placeholder password hashes
 * ('$2y$10$placeholder') that don't match anything. Run this
 * script ONCE in the browser to set real bcrypt hashes for
 * every seeded account.
 *
 *   http://localhost/csc264-project/php/setup.php
 *
 * After it runs successfully you can delete this file.
 *
 * Demo credentials it sets:
 *   admin@bsu.uitm.edu.my          / Admin@123
 *   nursyalin@uitm.edu.my          / Mod@123
 *   mior@uitm.edu.my               / Mod@123
 *   2024220654@student.uitm.edu.my / Student@123
 */

require_once 'db_config.php';

// Block re-running once real hashes are in place. Comment out to force re-run.
$already = getOneResult(getDBConnection(),
    "SELECT id FROM users WHERE password = '\$2y\$10\$placeholder' LIMIT 1", [], '');
if (!$already) {
    echo '<!doctype html><html><head><title>BSU Setup</title>';
    echo '<link rel="stylesheet" href="../css/setup_styles.css"></head><body>';
    echo '<h1>BSU Setup</h1>';
    echo '<div class="note">Setup has already run (no placeholder hashes left). You can delete <code>php/setup.php</code>.</div>';
    echo '</body></html>';
    exit;
}

$accounts = [
    ['admin@bsu.uitm.edu.my',           'Admin@123'],
    ['nursyalin@uitm.edu.my',           'Mod@123'],
    ['mior@uitm.edu.my',                'Mod@123'],
    ['2024220654@student.uitm.edu.my',  'Student@123'],
];

$conn = getDBConnection();
$results = [];

foreach ($accounts as [$email, $plain]) {
    $hash = password_hash($plain, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("UPDATE users SET password = ? WHERE email = ?");
    $stmt->bind_param('ss', $hash, $email);
    $stmt->execute();
    $results[] = [
        'email'    => $email,
        'updated'  => $stmt->affected_rows,
        'password' => $plain,
    ];
    $stmt->close();
}
?>
<!doctype html>
<html>
<head>
    <meta charset="UTF-8">
    <title>BSU Setup</title>
    <link rel="stylesheet" href="../css/setup_styles.css">
</head>
<body>
<h1>BSU Setup — passwords hashed</h1>
<table>
    <thead><tr><th>Email</th><th>Password (login with this)</th><th>Updated rows</th></tr></thead>
    <tbody>
    <?php foreach ($results as $r): ?>
        <tr>
            <td><?= htmlspecialchars($r['email']) ?></td>
            <td><code><?= htmlspecialchars($r['password']) ?></code></td>
            <td class="<?= $r['updated'] ? 'ok' : 'bad' ?>"><?= intval($r['updated']) ?></td>
        </tr>
    <?php endforeach; ?>
    </tbody>
</table>
<div class="note">
    <strong>Done.</strong> Now go to <a href="../source/login_page.html">login_page.html</a>
    and sign in. You can delete <code>php/setup.php</code> once you've confirmed login works.
</div>
</body>
</html>
