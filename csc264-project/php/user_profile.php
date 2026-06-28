<?php
/**
 * =====================================================
 * USER PROFILE - PERSONAL DETAILS
 * =====================================================
 */

require_once 'db_config.php';
require_once 'auth.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {

    // GET: current user's full profile (used by the dashboard header
    // and the "Personal Details" panel on the booking form)
    case 'me':
        $u = requireLogin();
        // Add an "initials" field for the avatar
        $parts = preg_split('/\s+/', trim($u['full_name']));
        $initials = '';
        foreach ($parts as $p) { if ($p) $initials .= strtoupper(substr($p, 0, 1)); }
        $u['initials'] = substr($initials, 0, 2);
        jsonResponse(true, 'Success', $u);
        break;

    // POST: update editable parts of the profile (phone, faculty, program, campus)
    // Routes the update to the correct base table (user / student / staff).
    case 'update':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(false, 'POST required'); }
        $u = requireLogin();
        $data = readJsonBody();
        $conn = dbConnect();
        $uid = intval($u['id']);
        $updated_any = false;

        // Fields on `user` table
        if (isset($data['phone'])) {
            $stmt = $conn->prepare("UPDATE `user` SET contact_no = ? WHERE user_id = ?");
            $val = trim($data['phone']);
            $stmt->bind_param('si', $val, $uid);
            $stmt->execute();
            $stmt->close();
            $updated_any = true;
        }
        if (isset($data['campus'])) {
            $stmt = $conn->prepare("UPDATE `user` SET campus = ? WHERE user_id = ?");
            $val = trim($data['campus']);
            $stmt->bind_param('si', $val, $uid);
            $stmt->execute();
            $stmt->close();
            $updated_any = true;
        }

        // Fields on `student` table (only for students)
        if ($u['role'] === 'Student') {
            if (isset($data['faculty'])) {
                $stmt = $conn->prepare("UPDATE student SET department = ? WHERE user_id = ?");
                $val = trim($data['faculty']);
                $stmt->bind_param('si', $val, $uid);
                $stmt->execute();
                $stmt->close();
                $updated_any = true;
            }
            if (isset($data['program'])) {
                $stmt = $conn->prepare("UPDATE student SET program = ? WHERE user_id = ?");
                $val = trim($data['program']);
                $stmt->bind_param('si', $val, $uid);
                $stmt->execute();
                $stmt->close();
                $updated_any = true;
            }
        }

        if (!$updated_any) { jsonResponse(false, 'No fields to update'); }
        jsonResponse(true, 'Profile updated');
        break;

    default:
        jsonResponse(false, 'Invalid action');
}
