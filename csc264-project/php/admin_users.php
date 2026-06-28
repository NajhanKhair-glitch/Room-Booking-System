<?php
/**
 * =====================================================
 * ADMIN DASHBOARD - USER MANAGEMENT OPERATIONS
 * =====================================================
 */

require_once 'db_config.php';
require_once 'auth.php';

requireRole(['Admin']);   // only Admin manages users

$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {

    case 'get_users':
        $rows = queryAll(
            "SELECT u.user_id AS id, u.name AS full_name, u.email, u.contact_no AS phone, u.campus,
                    COALESCE(s.student_no, st.staff_no) AS student_no,
                    s.department AS faculty, s.program,
                    CASE
                        WHEN u.user_category = 'Student' THEN 'Student'
                        WHEN st.permission = 'Admin' OR st.permission = 'SuperAdmin' THEN 'Admin'
                        WHEN st.permission = 'Moderator' THEN 'Moderator'
                        ELSE u.user_category
                    END AS role,
                    u.status, u.created_at
             FROM user u
             LEFT JOIN student s ON s.user_id = u.user_id
             LEFT JOIN staff st ON st.user_id = u.user_id
             ORDER BY u.name ASC",
            [], ''
        );
        jsonResponse(true, 'Success', $rows);
        break;

    case 'get_user_by_id':
        $user_id = intval($_GET['user_id'] ?? 0);
        if (!$user_id) { jsonResponse(false, 'user_id required'); }
        $row = queryOne(
            "SELECT u.user_id AS id, u.name AS full_name, u.email, u.contact_no AS phone, u.campus,
                    COALESCE(s.student_no, st.staff_no) AS student_no,
                    s.department AS faculty, s.program,
                    CASE
                        WHEN u.user_category = 'Student' THEN 'Student'
                        WHEN st.permission = 'Admin' OR st.permission = 'SuperAdmin' THEN 'Admin'
                        WHEN st.permission = 'Moderator' THEN 'Moderator'
                        ELSE u.user_category
                    END AS role,
                    u.status, u.created_at
             FROM user u
             LEFT JOIN student s ON s.user_id = u.user_id
             LEFT JOIN staff st ON st.user_id = u.user_id
             WHERE u.user_id = ?",
            [$user_id], 'i'
        );
        if (!$row) { jsonResponse(false, 'User not found'); }
        jsonResponse(true, 'Success', $row);
        break;

    case 'get_users_by_role':
        $role = $_GET['role'] ?? '';
        if (!in_array($role, ['Student', 'Moderator', 'Admin'])) {
            jsonResponse(false, 'Invalid role');
        }
        $role_condition = $role === 'Student' ? "u.user_category = 'Student'" :
                         ($role === 'Admin' ? "st.permission IN ('Admin','SuperAdmin')" : "st.permission = 'Moderator'");
        $rows = queryAll(
            "SELECT u.user_id AS id, u.name AS full_name, COALESCE(s.student_no, st.staff_no) AS student_no,
                    u.email, u.contact_no AS phone, s.department AS faculty, u.user_category AS role, u.status
             FROM user u
             LEFT JOIN student s ON s.user_id = u.user_id
             LEFT JOIN staff st ON st.user_id = u.user_id
             WHERE $role_condition ORDER BY u.name ASC",
            [], ''
        );
        jsonResponse(true, 'Success', $rows);
        break;

    case 'add_user':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(false, 'POST required'); }
        $data = readJsonBody();
        $required = ['full_name', 'email', 'password'];
        foreach ($required as $f) {
            if (empty($data[$f])) { jsonResponse(false, "Field '$f' is required"); }
        }

        $role = $data['role'] ?? 'Student';
        if (!in_array($role, ['Student', 'Moderator', 'Admin'])) {
            jsonResponse(false, 'Invalid role');
        }

        // Duplicate email check
        $exists = queryOne(
            "SELECT user_id FROM user WHERE email = ?",
            [$data['email']], 's'
        );
        if ($exists) { jsonResponse(false, 'Email already exists'); }

        $conn = dbConnect();
        $conn->begin_transaction();

        try {
            // Insert into user table
            $user_data = [
                'name'          => $data['full_name'],
                'email'         => $data['email'],
                'password'      => password_hash($data['password'], PASSWORD_DEFAULT),
                'contact_no'    => $data['phone'] ?? null,
                'campus'        => $data['campus'] ?? 'UITM Kampus Tapah',
                'user_category' => $role,
                'status'        => 'Active',
            ];
            $user_id = insertData($conn, 'user', $user_data);

            // If student, insert into student table
            if ($role === 'Student') {
                $student_data = [
                    'user_id'   => $user_id,
                    'student_no' => $data['student_no'] ?? null,
                    'department' => $data['faculty'] ?? null,
                    'program'   => $data['program'] ?? null,
                ];
                insertData($conn, 'student', $student_data);
            }
            // If staff, insert into staff table
            elseif (in_array($role, ['Moderator', 'Admin'])) {
                $staff_data = [
                    'user_id'   => $user_id,
                    'staff_no'  => $data['student_no'] ?? null, // reusing student_no field
                    'position'  => $data['program'] ?? null, // reusing program field
                    'permission' => $role === 'Admin' ? 'Admin' : 'Moderator',
                ];
                insertData($conn, 'staff', $staff_data);
            }

            $conn->commit();
            logAdminAction(currentUserId(), 'Add User', 'user', $user_id, ['email' => $data['email'], 'role' => $role]);
            jsonResponse(true, 'User added', ['user_id' => $user_id]);

        } catch (Exception $e) {
            $conn->rollback();
            jsonResponse(false, 'Failed to add user: ' . $e->getMessage());
        }
        break;

    case 'edit_user':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(false, 'POST required'); }
        $data = readJsonBody();
        $user_id = intval($data['user_id'] ?? 0);
        if (!$user_id) { jsonResponse(false, 'user_id required'); }

        $existing = queryOne("SELECT user_id FROM user WHERE user_id = ?", [$user_id], 'i');
        if (!$existing) { jsonResponse(false, 'User not found'); }

        $conn = dbConnect();
        $conn->begin_transaction();

        try {
            // Update user table
            $user_updates = [];
            if (isset($data['full_name'])) $user_updates['name'] = $data['full_name'];
            if (isset($data['email'])) $user_updates['email'] = $data['email'];
            if (isset($data['phone'])) $user_updates['contact_no'] = $data['phone'];
            if (isset($data['campus'])) $user_updates['campus'] = $data['campus'];
            if (isset($data['role'])) $user_updates['user_category'] = $data['role'];
            if (isset($data['status'])) $user_updates['status'] = $data['status'];
            if (!empty($data['password'])) {
                $user_updates['password'] = password_hash($data['password'], PASSWORD_DEFAULT);
            }

            if (!empty($user_updates['email'])) {
                $dup = queryOne(
                    "SELECT user_id FROM user WHERE email = ? AND user_id <> ?",
                    [$user_updates['email'], $user_id], 'si'
                );
                if ($dup) { jsonResponse(false, 'Email already in use'); }
            }

            if (!empty($user_updates)) {
                updateData($conn, 'user', $user_updates, 'user_id', $user_id);
            }

            // Handle student/staff updates
            $current_role = queryOne("SELECT user_category FROM user WHERE user_id = ?", [$user_id], 'i')['user_category'];

            if ($current_role === 'Student') {
                $student_updates = [];
                if (isset($data['student_no'])) $student_updates['student_no'] = $data['student_no'];
                if (isset($data['faculty'])) $student_updates['department'] = $data['faculty'];
                if (isset($data['program'])) $student_updates['program'] = $data['program'];
                if (!empty($student_updates)) {
                    updateData($conn, 'student', $student_updates, 'user_id', $user_id);
                }
            } elseif (in_array($current_role, ['Moderator', 'Admin'])) {
                $staff_updates = [];
                if (isset($data['student_no'])) $staff_updates['staff_no'] = $data['student_no'];
                if (isset($data['program'])) $staff_updates['position'] = $data['program'];
                if (isset($data['role'])) $staff_updates['permission'] = $data['role'] === 'Admin' ? 'Admin' : 'Moderator';
                if (!empty($staff_updates)) {
                    updateData($conn, 'staff', $staff_updates, 'user_id', $user_id);
                }
            }

            $conn->commit();
            logAdminAction(currentUserId(), 'Edit User', 'user', $user_id, array_keys($user_updates));
            jsonResponse(true, 'User updated');

        } catch (Exception $e) {
            $conn->rollback();
            jsonResponse(false, 'Failed to update user: ' . $e->getMessage());
        }
        break;

    case 'delete_user':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(false, 'POST required'); }
        $data = readJsonBody();
        $user_id = intval($data['user_id'] ?? 0);
        if (!$user_id) { jsonResponse(false, 'user_id required'); }

        if ($user_id === currentUserId()) {
            jsonResponse(false, 'You cannot delete your own account');
        }

        // Check role via JOIN (read from view OK)
        $user = queryOne("SELECT role FROM users WHERE id = ?", [$user_id], 'i');
        if (!$user) { jsonResponse(false, 'User not found'); }

        if ($user['role'] === 'Admin') {
            $count = queryOne(
                "SELECT COUNT(*) AS c FROM user u
                 JOIN staff st ON st.user_id = u.user_id
                 WHERE st.permission IN ('Admin','SuperAdmin')", [], ''
            )['c'];
            if (intval($count) <= 1) { jsonResponse(false, 'Cannot delete the only admin'); }
        }

        // Delete from base `user` table — ON DELETE CASCADE removes student/staff rows
        $success = deleteData(dbConnect(), 'user', 'user_id', $user_id);
        if (!$success) { jsonResponse(false, 'Failed to delete user'); }
        logAdminAction(currentUserId(), 'Delete User', 'user', $user_id);
        jsonResponse(true, 'User deleted');
        break;

    case 'change_role':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(false, 'POST required'); }
        $data = readJsonBody();
        $user_id  = intval($data['user_id'] ?? 0);
        $new_role = $data['role'] ?? '';
        if (!$user_id || !in_array($new_role, ['Student', 'Moderator', 'Admin'])) {
            jsonResponse(false, 'user_id and valid role required');
        }

        $conn = dbConnect();
        $conn->begin_transaction();
        try {
            // Update user_category on `user`
            $category = $new_role === 'Student' ? 'Student' : ($new_role === 'Admin' ? 'Admin' : 'Staff');
            $stmt = $conn->prepare("UPDATE `user` SET user_category = ? WHERE user_id = ?");
            $stmt->bind_param('si', $category, $user_id);
            $stmt->execute();
            $stmt->close();

            // Clean up old role-specific rows then create the new one
            if ($new_role === 'Student') {
                // Remove from staff if present, ensure student row exists
                $conn->query("DELETE FROM staff WHERE user_id = $user_id");
                $exists = queryOne("SELECT user_id FROM student WHERE user_id = ?", [$user_id], 'i');
                if (!$exists) {
                    $stmt = $conn->prepare("INSERT INTO student (user_id, student_no, department, program) VALUES (?, ?, '', '')");
                    $sno = 'STU' . str_pad($user_id, 6, '0', STR_PAD_LEFT);
                    $stmt->bind_param('is', $user_id, $sno);
                    $stmt->execute();
                    $stmt->close();
                }
            } else {
                // Moderator or Admin → staff
                $conn->query("DELETE FROM student WHERE user_id = $user_id");
                $permission = $new_role === 'Admin' ? 'Admin' : 'Moderator';
                $exists = queryOne("SELECT user_id FROM staff WHERE user_id = ?", [$user_id], 'i');
                if ($exists) {
                    $stmt = $conn->prepare("UPDATE staff SET permission = ? WHERE user_id = ?");
                    $stmt->bind_param('si', $permission, $user_id);
                    $stmt->execute();
                    $stmt->close();
                } else {
                    $stmt = $conn->prepare("INSERT INTO staff (user_id, staff_no, position, permission) VALUES (?, ?, ?, ?)");
                    $sno = 'STAFF' . str_pad($user_id, 5, '0', STR_PAD_LEFT);
                    $position = $new_role === 'Admin' ? 'System Administrator' : 'Space Moderator';
                    $stmt->bind_param('isss', $user_id, $sno, $position, $permission);
                    $stmt->execute();
                    $stmt->close();
                }
            }

            $conn->commit();
            logAdminAction(currentUserId(), 'Change Role', 'user', $user_id, ['role' => $new_role]);
            jsonResponse(true, 'Role updated');
        } catch (Exception $e) {
            $conn->rollback();
            jsonResponse(false, 'Failed to change role: ' . $e->getMessage());
        }
        break;

    case 'change_status':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { jsonResponse(false, 'POST required'); }
        $data = readJsonBody();
        $user_id    = intval($data['user_id'] ?? 0);
        $new_status = $data['status'] ?? '';
        if (!$user_id || !in_array($new_status, ['Active', 'Inactive'])) {
            jsonResponse(false, 'user_id and valid status required');
        }
        // Status lives on `user` table
        $conn = dbConnect();
        $stmt = $conn->prepare("UPDATE `user` SET status = ? WHERE user_id = ?");
        $stmt->bind_param('si', $new_status, $user_id);
        $ok = $stmt->execute();
        $stmt->close();
        if (!$ok) { jsonResponse(false, 'Failed to change status'); }
        logAdminAction(currentUserId(), 'Change Status', 'user', $user_id, ['status' => $new_status]);
        jsonResponse(true, 'Status updated');
        break;

    default:
        jsonResponse(false, 'Invalid action');
}
