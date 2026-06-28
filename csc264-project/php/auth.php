<?php
/**
 * =====================================================
 * AUTHENTICATION & SESSION HELPERS
 * =====================================================
 *
 * Endpoints:
 *   POST  auth.php?action=login        body: {email, password}
 *   POST  auth.php?action=logout
 *   GET   auth.php?action=session      returns current logged-in user (if any)
 *   POST  auth.php?action=change_password
 *
 * Plus reusable helpers other PHP files include:
 *   requireLogin(), requireRole([...]), currentUser(), currentUserId(),
 *   readJsonBody(), logAdminAction()
 */

require_once __DIR__ . '/db_config.php';

// Start session for every request that loads this file
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

// ---------------------------------------------------------------------------
// Helpers used by other endpoints
// ---------------------------------------------------------------------------

function readJsonBody() {
    $raw = file_get_contents('php://input');
    if (!$raw) return $_POST;
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : $_POST;
}

function currentUser() {
    if (empty($_SESSION['user_id'])) return null;
    // Refresh from DB so role/status changes propagate
    $u = queryOne(
        "SELECT id, full_name, student_no, email, phone, campus,
                faculty, program, role, status
         FROM users WHERE id = ?",
        [intval($_SESSION['user_id'])], 'i'
    );
    if (!$u || $u['status'] !== 'Active') {
        $_SESSION = [];
        session_destroy();
        return null;
    }
    return $u;
}

function currentUserId() {
    return intval($_SESSION['user_id'] ?? 0);
}

function requireLogin() {
    $u = currentUser();
    if (!$u) {
        http_response_code(401);
        jsonResponse(false, 'Not logged in');
    }
    return $u;
}

function requireRole($allowed_roles) {
    $u = requireLogin();
    if (!in_array($u['role'], $allowed_roles, true)) {
        http_response_code(403);
        jsonResponse(false, 'Access denied for role ' . $u['role']);
    }
    return $u;
}

function logAdminAction($admin_id, $action_name, $table = null, $target_id = null, $details = null) {
    $conn = dbConnect();
    $sql  = "INSERT INTO admin_logs (admin_id, action, target_table, target_id, details)
             VALUES (?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    if (!$stmt) return false;
    $details_json = $details === null ? null : json_encode($details);
    $stmt->bind_param('issis', $admin_id, $action_name, $table, $target_id, $details_json);
    return $stmt->execute();
}

// ---------------------------------------------------------------------------
// Endpoint dispatcher — only runs when auth.php is hit directly
// ---------------------------------------------------------------------------

if (basename($_SERVER['SCRIPT_FILENAME']) !== 'auth.php') {
    return;   // included as a library, not invoked as a page
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {

    case 'login':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(false, 'POST required'); }
        $data = readJsonBody();
        $email    = strtolower(trim($data['email'] ?? ''));
        $password = $data['password'] ?? '';
        if (!$email || !$password) { jsonResponse(false, 'Email and password required'); }

        // Validate UiTM email format
        $isStudentEmail = preg_match('/^[a-z0-9._-]+@student\.uitm\.edu\.my$/', $email);
        $isStaffEmail   = preg_match('/^[a-z0-9._-]+@(bsu\.)?uitm\.edu\.my$/', $email)
                          && !str_ends_with($email, '@student.uitm.edu.my');
        if (!$isStudentEmail && !$isStaffEmail) {
            jsonResponse(false, 'Email must be UiTM (student/staff/admin) format');
        }

        $user = queryOne(
            "SELECT id, full_name, email, password, role, status
             FROM users WHERE email = ? LIMIT 1",
            [$email], 's'
        );
        if (!$user || $user['status'] !== 'Active') {
            jsonResponse(false, 'Invalid credentials');
        }
        if (!password_verify($password, $user['password'])) {
            jsonResponse(false, 'Invalid credentials');
        }

        // Rotate session id to defend against fixation
        session_regenerate_id(true);
        $_SESSION['user_id']    = intval($user['id']);
        $_SESSION['user_role']  = $user['role'];
        $_SESSION['login_time'] = time();

        // Role-based redirect
        $redirect = match ($user['role']) {
            'Student'   => 'user_dashboard.html',
            'Moderator' => 'admin_dashboard.html',
            'Admin'     => 'admin_dashboard.html',
            default     => 'user_dashboard.html',
        };

        jsonResponse(true, 'Logged in', [
            'id'        => intval($user['id']),
            'full_name' => $user['full_name'],
            'email'     => $user['email'],
            'role'      => $user['role'],
            'redirect'  => $redirect,
        ]);
        break;

    case 'logout':
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        }
        session_destroy();
        jsonResponse(true, 'Logged out');
        break;

    case 'signup':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(false, 'POST required'); }
        $data = readJsonBody();
        $full_name  = trim($data['full_name'] ?? '');
        $student_no = trim($data['student_no'] ?? '');
        $email      = strtolower(trim($data['email'] ?? ''));
        $phone      = $data['phone'] ?? '';
        $faculty    = trim($data['faculty'] ?? '');
        $program    = trim($data['program'] ?? '');
        $campus     = trim($data['campus'] ?? 'UITM Kampus Tapah');
        $password   = $data['password'] ?? '';

        if (!$full_name || !$student_no || !$email || !$password) {
            jsonResponse(false, 'Full name, student number, email, and password required');
        }

        // Validate student email format
        if (!preg_match('/^[a-z0-9._-]+@student\.uitm\.edu\.my$/', $email)) {
            jsonResponse(false, 'Student email must be: <student_id>@student.uitm.edu.my');
        }
        if (!preg_match('/^\d{6,12}$/', $student_no)) {
            jsonResponse(false, 'Student number must be 6-12 digits');
        }

        if (strlen($password) < 6) {
            jsonResponse(false, 'Password must be at least 6 characters');
        }

        // Check if email or student number already exists
        $existing = queryOne(
            "SELECT id FROM users WHERE email = ? OR student_no = ? LIMIT 1",
            [$email, $student_no], 'ss'
        );
        if ($existing) {
            jsonResponse(false, 'Email or student number already registered');
        }

        // Hash password and insert into new schema (user + student)
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        $conn = dbConnect();

        $stmt = $conn->prepare(
            "INSERT INTO `user` (name, email, password, contact_no, campus, user_category, status)
             VALUES (?, ?, ?, ?, ?, 'Student', 'Active')"
        );
        $stmt->bind_param('sssss', $full_name, $email, $passwordHash, $phone, $campus);
        if (!$stmt->execute()) {
            jsonResponse(false, 'Failed to create account: ' . $stmt->error);
        }
        $new_user_id = $conn->insert_id;
        $stmt->close();

        // Insert into student specialization (with faculty + program)
        $stmt = $conn->prepare(
            "INSERT INTO student (user_id, student_no, department, program) VALUES (?, ?, ?, ?)"
        );
        $stmt->bind_param('isss', $new_user_id, $student_no, $faculty, $program);
        if (!$stmt->execute()) {
            // Rollback user insert
            $conn->query("DELETE FROM `user` WHERE user_id = $new_user_id");
            jsonResponse(false, 'Failed to create student record: ' . $stmt->error);
        }
        $stmt->close();

        jsonResponse(true, 'Account created successfully. You can now log in.', [
            'user_id' => $new_user_id,
            'email' => $email,
        ]);
        break;

    case 'session':
        $u = currentUser();
        if (!$u) { jsonResponse(false, 'Not logged in'); }
        jsonResponse(true, 'Active session', $u);
        break;

    case 'change_password':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(false, 'POST required'); }
        $u = requireLogin();
        $data = readJsonBody();
        $old = $data['old_password'] ?? '';
        $new = $data['new_password'] ?? '';
        if (!$old || !$new) { jsonResponse(false, 'Old and new password required'); }
        if (strlen($new) < 6) { jsonResponse(false, 'New password must be at least 6 characters'); }

        $row = queryOne("SELECT password FROM users WHERE id = ?", [$u['id']], 'i');
        if (!$row || !password_verify($old, $row['password'])) {
            jsonResponse(false, 'Old password incorrect');
        }
        updateData(
            dbConnect(), 'users',
            ['password' => password_hash($new, PASSWORD_DEFAULT)],
            'id', $u['id']
        );
        jsonResponse(true, 'Password changed');
        break;

    default:
        jsonResponse(false, 'Invalid action');
}
