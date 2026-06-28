<?php
/**
 * =====================================================
 * MOCK UITM CENTRAL SSO API (SIMULATED)
 * =====================================================
 *
 * Endpoint ini simulasi UiTM central authentication server.
 * Dalam realiti, endpoint ni di server UiTM (cth: sso.uitm.edu.my/api/authenticate).
 *
 * Untuk demo CSC264 project, kita run secara local.
 *
 * Endpoints:
 *   POST  uitm_sso_api.php?action=authenticate   body: {student_id, password}
 *         → Validates credentials and issues a temporary SSO token
 *
 *   GET   uitm_sso_api.php?action=verify_token&token=XXX
 *         → Returns user info if token valid, error if invalid/expired
 */

require_once 'db_config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json');

$action = $_GET['action'] ?? $_POST['action'] ?? '';

/**
 * Simulate UiTM Directory Service
 * In real life, this queries UiTM's LDAP/Active Directory.
 * For our demo, we query the existing users table by student_no or email.
 */
function lookupUitmUser($identifier, $password) {
    // Try by student_no first, then by email
    $user = queryOne(
        "SELECT id, full_name, student_no, email, password, role, status, faculty, program, campus, phone
         FROM users
         WHERE (student_no = ? OR email = ?) AND status = 'Active'
         LIMIT 1",
        [$identifier, $identifier], 'ss'
    );

    if (!$user) return null;
    if (!password_verify($password, $user['password'])) return null;

    return $user;
}

/**
 * Generate a cryptographically-secure SSO token
 */
function generateSsoToken() {
    return bin2hex(random_bytes(32)); // 64-char hex token
}

switch ($action) {

    /* ============================================================
       AUTHENTICATE - validate UiTM credentials, issue SSO token
       ============================================================ */
    case 'authenticate':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['success' => false, 'error_code' => 'METHOD_NOT_ALLOWED', 'message' => 'POST required']);
            exit;
        }

        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?: $_POST;

        $student_id = trim($data['student_id'] ?? '');
        $password   = $data['password'] ?? '';

        if (!$student_id || !$password) {
            echo json_encode([
                'success' => false,
                'error_code' => 'MISSING_CREDENTIALS',
                'message' => 'Student ID dan password diperlukan'
            ]);
            exit;
        }

        // Simulate UiTM directory lookup
        $user = lookupUitmUser($student_id, $password);

        if (!$user) {
            // Simulate UiTM response delay (security: prevent timing attacks)
            usleep(500000); // 0.5s
            echo json_encode([
                'success' => false,
                'error_code' => 'INVALID_CREDENTIALS',
                'message' => 'Student ID atau password tidak sah. Sila cuba lagi.'
            ]);
            exit;
        }

        // Generate SSO token (15 min expiry)
        $token = generateSsoToken();
        $expires_at = time() + (15 * 60);

        // Store token in PHP session (in real UiTM SSO, this would be in Redis/database)
        $_SESSION['uitm_sso_tokens'][$token] = [
            'user_id'    => intval($user['id']),
            'student_no' => $user['student_no'],
            'email'      => $user['email'],
            'full_name'  => $user['full_name'],
            'role'       => $user['role'],
            'faculty'    => $user['faculty'],
            'program'    => $user['program'],
            'campus'     => $user['campus'],
            'phone'      => $user['phone'],
            'expires_at' => $expires_at,
        ];

        echo json_encode([
            'success' => true,
            'message' => 'Authentication berjaya',
            'sso_token' => $token,
            'expires_in' => 900, // 15 min in seconds
            'user' => [
                'student_no' => $user['student_no'],
                'full_name'  => $user['full_name'],
                'email'      => $user['email'],
                'role'       => $user['role'],
            ],
        ]);
        break;

    /* ============================================================
       VERIFY TOKEN - check if SSO token is valid
       ============================================================ */
    case 'verify_token':
        $token = $_GET['token'] ?? '';
        if (!$token) {
            echo json_encode(['success' => false, 'error_code' => 'NO_TOKEN', 'message' => 'Token diperlukan']);
            exit;
        }

        $tokenData = $_SESSION['uitm_sso_tokens'][$token] ?? null;

        if (!$tokenData) {
            echo json_encode([
                'success' => false,
                'error_code' => 'INVALID_TOKEN',
                'message' => 'Token tidak sah atau telah dibatalkan'
            ]);
            exit;
        }

        if (time() > $tokenData['expires_at']) {
            unset($_SESSION['uitm_sso_tokens'][$token]);
            echo json_encode([
                'success' => false,
                'error_code' => 'TOKEN_EXPIRED',
                'message' => 'Token sudah luput. Sila login semula.'
            ]);
            exit;
        }

        echo json_encode([
            'success' => true,
            'message' => 'Token valid',
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
        ]);
        break;

    /* ============================================================
       REVOKE TOKEN - invalidate after single use
       ============================================================ */
    case 'revoke_token':
        $token = $_GET['token'] ?? $_POST['token'] ?? '';
        if ($token && isset($_SESSION['uitm_sso_tokens'][$token])) {
            unset($_SESSION['uitm_sso_tokens'][$token]);
        }
        echo json_encode(['success' => true, 'message' => 'Token revoked']);
        break;

    default:
        echo json_encode(['success' => false, 'error_code' => 'INVALID_ACTION', 'message' => 'Invalid action']);
}
