<?php
/**
 * =====================================================
 * NOTIFICATION SYSTEM API
 * =====================================================
 *
 * Endpoints:
 *   GET  notifications.php?action=list        — get current user's notifications
 *   GET  notifications.php?action=unread_count — get unread count for bell badge
 *   POST notifications.php?action=mark_read   — body: {notification_id}
 *   POST notifications.php?action=mark_all_read
 *
 * Helper (used by other PHP files):
 *   createNotification($user_id, $type, $title, $message, $related_table, $related_id)
 */

require_once 'db_config.php';
require_once 'auth.php';

/**
 * Create a notification for a user
 */
function createNotification($user_id, $type, $title, $message, $related_table = null, $related_id = null) {
    $conn = dbConnect();
    $stmt = $conn->prepare(
        "INSERT INTO notification (user_id, type, title, message, related_table, related_id)
         VALUES (?, ?, ?, ?, ?, ?)"
    );
    if (!$stmt) return false;
    $stmt->bind_param('issssi', $user_id, $type, $title, $message, $related_table, $related_id);
    $ok = $stmt->execute();
    $stmt->close();
    return $ok;
}

// Only dispatch if this file is hit directly
if (basename($_SERVER['SCRIPT_FILENAME']) !== 'notifications.php') {
    return;
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$user = requireLogin();

switch ($action) {

    case 'list':
        $rows = queryAll(
            "SELECT notification_id, type, title, message, related_table, related_id,
                    is_read, created_at, read_at
             FROM notification
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 50",
            [intval($user['id'])], 'i'
        );
        jsonResponse(true, 'Notifications fetched', $rows);
        break;

    case 'unread_count':
        $row = queryOne(
            "SELECT COUNT(*) AS c FROM notification WHERE user_id = ? AND is_read = 0",
            [intval($user['id'])], 'i'
        );
        jsonResponse(true, 'Unread count', ['count' => intval($row['c'])]);
        break;

    case 'mark_read':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            jsonResponse(false, 'POST required');
        }
        $data = readJsonBody();
        $nid = intval($data['notification_id'] ?? 0);
        if (!$nid) jsonResponse(false, 'notification_id required');

        $conn = dbConnect();
        $stmt = $conn->prepare(
            "UPDATE notification SET is_read = 1, read_at = NOW()
             WHERE notification_id = ? AND user_id = ?"
        );
        $uid = intval($user['id']);
        $stmt->bind_param('ii', $nid, $uid);
        $stmt->execute();
        jsonResponse(true, 'Marked as read');
        break;

    case 'mark_all_read':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            jsonResponse(false, 'POST required');
        }
        $conn = dbConnect();
        $stmt = $conn->prepare(
            "UPDATE notification SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0"
        );
        $uid = intval($user['id']);
        $stmt->bind_param('i', $uid);
        $stmt->execute();
        jsonResponse(true, 'All marked as read', ['updated' => $conn->affected_rows]);
        break;

    default:
        jsonResponse(false, 'Invalid action');
}
