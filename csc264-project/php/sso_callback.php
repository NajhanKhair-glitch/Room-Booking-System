<?php
/**
 * =====================================================
 * SSO CALLBACK HANDLER
 * =====================================================
 *
 * Receives SSO token dari UiTM SSO API (simulated),
 * validates token, and creates local session in BSU
 * Booking System.
 *
 * Flow:
 *   1. User authenticated di UiTM SSO portal
 *   2. UiTM SSO redirects user kepada endpoint ni dengan ?token=XXX
 *   3. Kita verify token dengan UiTM SSO API
 *   4. Get user info from token
 *   5. Find/match user dalam local database
 *   6. Create local session dan redirect ke dashboard
 */

require_once 'db_config.php';
require_once 'auth.php';

$token = $_GET['token'] ?? '';

if (!$token) {
    header('Location: ../source/login_page.html?sso_error=no_token');
    exit;
}

/**
 * Verify token with UiTM SSO API (server-to-server call)
 * Dalam realiti, ni adalah cURL call ke UiTM server.
 * Untuk demo, kita read directly from session sebab kedua-dua run di server yang sama.
 */
function verifyTokenWithUitmSso($token) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    $tokenData = $_SESSION['uitm_sso_tokens'][$token] ?? null;
    if (!$tokenData) {
        return ['success' => false, 'message' => 'Invalid token'];
    }

    if (time() > $tokenData['expires_at']) {
        unset($_SESSION['uitm_sso_tokens'][$token]);
        return ['success' => false, 'message' => 'Token expired'];
    }

    return [
        'success' => true,
        'user' => [
            'user_id'    => $tokenData['user_id'],
            'student_no' => $tokenData['student_no'],
            'full_name'  => $tokenData['full_name'],
            'email'      => $tokenData['email'],
            'role'       => $tokenData['role'],
            'faculty'    => $tokenData['faculty'],
            'program'    => $tokenData['program'],
            'campus'     => $tokenData['campus'],
            'phone'      => $tokenData['phone'],
        ],
    ];
}

// Step 1: Verify token with UiTM SSO
$verification = verifyTokenWithUitmSso($token);

if (!$verification['success']) {
    header('Location: ../source/login_page.html?sso_error=' . urlencode($verification['message']));
    exit;
}

$uitmUser = $verification['user'];

// Step 2: Match SSO user dengan local users database
$localUser = queryOne(
    "SELECT id, full_name, email, role, status FROM users WHERE id = ? AND status = 'Active'",
    [$uitmUser['user_id']], 'i'
);

if (!$localUser) {
    // Auto-provision: SSO user not yet in local DB → create student account
    $conn = dbConnect();
    $randomPass = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);
    $name = $uitmUser['full_name'];
    $email = $uitmUser['email'];
    $phone = $uitmUser['phone'] ?? '';
    $campus = $uitmUser['campus'] ?? 'UITM Kampus Tapah';

    $stmt = $conn->prepare(
        "INSERT INTO `user` (name, email, password, contact_no, campus, user_category, status)
         VALUES (?, ?, ?, ?, ?, 'Student', 'Active')"
    );
    $stmt->bind_param('sssss', $name, $email, $randomPass, $phone, $campus);
    if (!$stmt->execute()) {
        header('Location: ../source/login_page.html?sso_error=provision_failed');
        exit;
    }
    $newId = $conn->insert_id;
    $stmt->close();

    // Insert student specialization
    $faculty = $uitmUser['faculty'] ?? '';
    $program = $uitmUser['program'] ?? '';
    $student_no = $uitmUser['student_no'] ?? ('STU' . $newId);
    $stmt = $conn->prepare(
        "INSERT INTO student (user_id, student_no, department, program) VALUES (?, ?, ?, ?)"
    );
    $stmt->bind_param('isss', $newId, $student_no, $faculty, $program);
    $stmt->execute();
    $stmt->close();

    $localUser = queryOne("SELECT id, full_name, email, role, status FROM users WHERE id = ?", [$newId], 'i');
}

// Step 3: Create local session
session_regenerate_id(true);
$_SESSION['user_id']     = intval($localUser['id']);
$_SESSION['user_role']   = $localUser['role'];
$_SESSION['login_time']  = time();
$_SESSION['login_via']   = 'UiTM SSO';

// Step 4: Revoke the SSO token (single-use)
unset($_SESSION['uitm_sso_tokens'][$token]);

// Step 5: Redirect to appropriate dashboard based on role
$redirect = match ($localUser['role']) {
    'Student'   => '../source/user_dashboard.html',
    'Moderator' => '../source/admin_dashboard.html',
    'Admin'     => '../source/admin_dashboard.html',
    default     => '../source/user_dashboard.html',
};

header('Location: ' . $redirect . '?sso=success');
exit;
