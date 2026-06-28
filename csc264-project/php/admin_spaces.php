<?php
/**
 * =====================================================
 * ADMIN DASHBOARD - SPACE OPERATIONS
 * =====================================================
 */

require_once 'db_config.php';
require_once 'auth.php';

requireRole(['Moderator', 'Admin']);

$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {

    // GET: all spaces (admin sees inactive ones too)
    case 'get_spaces':
        $rows = queryAll(
            "SELECT space_id AS id, space_code, space_name, space_category AS category, campus, faculty AS department,
                    operation_time, seating_capacity, hourly_rate, moderator AS moderator_names,
                    PIC AS person_incharge, is_active, created_at
             FROM space
             ORDER BY space_code ASC",
            [], ''
        );
        jsonResponse(true, 'Success', $rows);
        break;

    case 'get_space_by_id':
        $space_id = intval($_GET['space_id'] ?? 0);
        if (!$space_id) { jsonResponse(false, 'space_id required'); }
        $row = queryOne("SELECT space_id AS id, space_code, space_name, space_category AS category, campus,
                        faculty AS department, operation_time, seating_capacity, moderator AS moderator_names,
                        PIC AS person_incharge, is_active, created_at FROM space WHERE space_id = ?", [$space_id], 'i');
        if (!$row) { jsonResponse(false, 'Space not found'); }
        jsonResponse(true, 'Success', $row);
        break;

    case 'get_categories':
        $rows = queryAll(
            "SELECT DISTINCT space_category AS category FROM space ORDER BY space_category",
            [], ''
        );
        jsonResponse(true, 'Success', array_column($rows, 'category'));
        break;

    // POST: create a new space
    case 'add_space':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(false, 'POST required'); }
        $data = readJsonBody();
        $required = ['space_code', 'space_name', 'category'];
        foreach ($required as $f) {
            if (empty($data[$f])) { jsonResponse(false, "Field '$f' is required"); }
        }
        $existing = queryOne("SELECT space_id FROM space WHERE space_code = ?", [$data['space_code']], 's');
        if ($existing) { jsonResponse(false, 'Space code already exists'); }

        $space_data = [
            'space_code'       => $data['space_code'],
            'space_name'       => $data['space_name'],
            'space_category'   => $data['category'],
            'campus'           => $data['campus']           ?? 'UITM Kampus Tapah',
            'faculty'          => $data['department']       ?? 'UITM KAMPUS TAPAH',
            'operation_time'   => $data['operation_time']   ?? '08:00 - 18:00',
            'seating_capacity' => intval($data['seating_capacity'] ?? 0),
            'hourly_rate'      => floatval($data['hourly_rate'] ?? 0),
            'moderator'        => $data['moderator_names']  ?? null,
            'PIC'              => $data['person_incharge']  ?? null,
            'is_active'        => 1,
        ];
        $space_id = insertData(dbConnect(), 'space', $space_data);
        if (!$space_id) { jsonResponse(false, 'Failed to add space'); }
        logAdminAction(currentUserId(), 'Add Space', 'space', $space_id, ['space_code' => $data['space_code']]);
        jsonResponse(true, 'Space added', ['space_id' => $space_id]);
        break;

    // POST: edit an existing space
    case 'edit_space':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(false, 'POST required'); }
        $data = readJsonBody();
        $space_id = intval($data['space_id'] ?? 0);
        if (!$space_id) { jsonResponse(false, 'space_id required'); }

        $existing = queryOne("SELECT space_id FROM space WHERE space_id = ?", [$space_id], 'i');
        if (!$existing) { jsonResponse(false, 'Space not found'); }

        $allowed = ['space_code', 'space_name', 'category', 'campus', 'department',
                    'operation_time', 'seating_capacity', 'hourly_rate', 'moderator_names',
                    'person_incharge', 'is_active'];
        $update_data = [];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $data)) {
                $col = $f === 'category' ? 'space_category'
                     : ($f === 'department' ? 'faculty'
                     : ($f === 'moderator_names' ? 'moderator'
                     : ($f === 'person_incharge' ? 'PIC' : $f)));
                if ($f === 'seating_capacity' || $f === 'is_active') {
                    $update_data[$col] = intval($data[$f]);
                } elseif ($f === 'hourly_rate') {
                    $update_data[$col] = floatval($data[$f]);
                } else {
                    $update_data[$col] = $data[$f];
                }
            }
        }
        if (empty($update_data)) { jsonResponse(false, 'No data to update'); }

        $success = updateData(dbConnect(), 'space', $update_data, 'space_id', $space_id);
        // updateData() returns false when affected_rows == 0 (no actual change),
        // which is fine for an idempotent edit
        logAdminAction(currentUserId(), 'Edit Space', 'space', $space_id, $update_data);
        jsonResponse(true, 'Space updated');
        break;

    // POST: delete a space
    case 'delete_space':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(false, 'POST required'); }
        $data = readJsonBody();
        $space_id = intval($data['space_id'] ?? 0);
        if (!$space_id) { jsonResponse(false, 'space_id required'); }

        $active = queryOne(
            "SELECT id FROM bookings
             WHERE space_id = ? AND status IN ('Approved','In Progress','Pending')
             LIMIT 1",
            [$space_id], 'i'
        );
        if ($active) {
            jsonResponse(false, 'Cannot delete: space has active or pending bookings. Deactivate it instead.');
        }
        // Delete from base `space` table — ON DELETE CASCADE handles space_reservation
        $success = deleteData(dbConnect(), 'space', 'space_id', $space_id);
        if (!$success) { jsonResponse(false, 'Failed to delete space'); }
        logAdminAction(currentUserId(), 'Delete Space', 'space', $space_id);
        jsonResponse(true, 'Space deleted');
        break;

    // POST: soft-delete (deactivate) instead of hard delete
    case 'toggle_active':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(false, 'POST required'); }
        $data = readJsonBody();
        $space_id  = intval($data['space_id']  ?? 0);
        $is_active = intval($data['is_active'] ?? 0);
        if (!$space_id) { jsonResponse(false, 'space_id required'); }
        updateData(dbConnect(), 'space', ['is_active' => $is_active], 'space_id', $space_id);
        logAdminAction(currentUserId(), 'Toggle Space Active', 'space', $space_id, ['is_active' => $is_active]);
        jsonResponse(true, 'Space status updated');
        break;

    default:
        jsonResponse(false, 'Invalid action');
}
