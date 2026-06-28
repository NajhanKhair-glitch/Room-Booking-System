<?php
/**
 * =====================================================
 * DATABASE CONNECTION & CONFIGURATION
 * =====================================================
 * 
 * This file handles all database connection operations
 * for the BSU Admin Dashboard system.
 */

// Database Configuration
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASSWORD', '');  // Change this to your MySQL password
define('DB_NAME', 'bsu_space_booking');
define('DB_PORT', 3306);

// Error Reporting (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);  // Don't display errors to users
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/logs/php_errors.log');

/**
 * Global safety net: turn any uncaught exception or fatal error into a
 * proper JSON response instead of an empty HTTP 500. Without this, a crashing
 * endpoint returns a blank body and the frontend shows the cryptic
 * "Network error: Unexpected end of JSON input".
 */
set_exception_handler(function ($e) {
    error_log('[Uncaught] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json');
    }
    echo json_encode(['success' => false, 'message' => 'Server error. Please try again.']);
    exit;
});
register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        error_log('[Fatal] ' . $err['message'] . ' in ' . $err['file'] . ':' . $err['line']);
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json');
        }
        echo json_encode(['success' => false, 'message' => 'Server error. Please try again.']);
    }
});

/**
 * Create Database Connection
 * Using MySQLi for better security and features
 */
function getDBConnection() {
    static $conn = null;
    
    // Return existing connection if available
    if ($conn !== null) {
        return $conn;
    }
    
    try {
        // Create connection using MySQLi
        $conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT);
        
        // Check connection
        if ($conn->connect_error) {
            throw new Exception('Database connection failed: ' . $conn->connect_error);
        }
        
        // Set charset to utf8mb4 for better character support
        $conn->set_charset("utf8mb4");
        
        return $conn;
    } catch (Exception $e) {
        error_log($e->getMessage());
        die(json_encode(['success' => false, 'message' => 'Database connection error']));
    }
}

/**
 * Close Database Connection
 */
function closeDBConnection($conn) {
    if ($conn) {
        $conn->close();
    }
}

/**
 * Execute Query with Error Handling
 */
function executeQuery($conn, $sql, $params = [], $types = '') {
    try {
        $stmt = $conn->prepare($sql);
        
        if (!$stmt) {
            throw new Exception('Prepare failed: ' . $conn->error);
        }
        
        // Bind parameters if provided
        if (!empty($params) && !empty($types)) {
            $stmt->bind_param($types, ...$params);
        }
        
        if (!$stmt->execute()) {
            throw new Exception('Execute failed: ' . $stmt->error);
        }
        
        return $stmt;
    } catch (Exception $e) {
        error_log($e->getMessage());
        return null;
    }
}

/**
 * Get Single Row Result
 */
function getOneResult($conn, $sql, $params = [], $types = '') {
    $stmt = executeQuery($conn, $sql, $params, $types);
    if (!$stmt) return null;
    
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    
    return $row;
}

/**
 * Get Multiple Rows Result
 */
function getAllResults($conn, $sql, $params = [], $types = '') {
    $stmt = executeQuery($conn, $sql, $params, $types);
    if (!$stmt) return [];
    
    $result = $stmt->get_result();
    $rows = [];
    
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
    
    $stmt->close();
    return $rows;
}

/**
 * Insert Data
 */
function insertData($conn, $table, $data) {
    $columns = array_keys($data);
    $values = array_values($data);
    $placeholders = array_fill(0, count($values), '?');
    
    $sql = "INSERT INTO $table (" . implode(',', $columns) . ") VALUES (" . implode(',', $placeholders) . ")";
    
    $types = '';
    foreach ($values as $val) {
        if (is_int($val)) $types .= 'i';
        elseif (is_float($val)) $types .= 'd';
        else $types .= 's';
    }
    
    $stmt = executeQuery($conn, $sql, $values, $types);
    
    if ($stmt) {
        $stmt->close();
        return $conn->insert_id;
    }
    
    return false;
}

/**
 * Update Data
 */
function updateData($conn, $table, $data, $where_col, $where_val) {
    $updates = [];
    $values = [];
    
    foreach ($data as $col => $val) {
        $updates[] = "$col = ?";
        $values[] = $val;
    }
    
    $values[] = $where_val;
    
    $sql = "UPDATE $table SET " . implode(',', $updates) . " WHERE $where_col = ?";
    
    $types = '';
    foreach ($values as $val) {
        if (is_int($val)) $types .= 'i';
        elseif (is_float($val)) $types .= 'd';
        else $types .= 's';
    }
    
    $stmt = executeQuery($conn, $sql, $values, $types);

    if ($stmt) {
        // Read affected_rows before closing (see deleteData note).
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected > 0;
    }

    return false;
}

/**
 * Delete Data
 */
function deleteData($conn, $table, $where_col, $where_val) {
    $sql = "DELETE FROM $table WHERE $where_col = ?";
    
    $type = is_int($where_val) ? 'i' : 's';
    
    $stmt = executeQuery($conn, $sql, [$where_val], $type);

    if ($stmt) {
        // Read affected_rows from the statement BEFORE closing it — $conn->affected_rows
        // is unreliable (often -1) once the statement is closed.
        $affected = $stmt->affected_rows;
        $stmt->close();
        return $affected > 0;
    }

    return false;
}

/**
 * Check if table exists
 */
function tableExists($conn, $table) {
    $sql = "SHOW TABLES LIKE '$table'";
    $result = $conn->query($sql);
    return ($result->num_rows > 0);
}

// API Response Helper
function sendResponse($success, $message = '', $data = null) {
    header('Content-Type: application/json');
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ]);
    exit();
}

// =====================================================
// SHORTHAND HELPERS (used by user_bookings.php, user_spaces.php, etc.)
// =====================================================

function dbConnect() {
    return getDBConnection();
}

function jsonResponse($success, $message = '', $data = null) {
    sendResponse($success, $message, $data);
}

function queryAll($sql, $params = [], $types = '') {
    return getAllResults(getDBConnection(), $sql, $params, $types);
}

function queryOne($sql, $params = [], $types = '') {
    return getOneResult(getDBConnection(), $sql, $params, $types);
}

/* =====================================================
   EMAIL NOTIFICATION HELPER
   ===================================================== */
function sendBookingNotificationEmail($user_email, $user_name, $booking_details, $status, $notes = '') {
    $to = $user_email;
    $subject = '';
    $message = '';
    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-type: text/html; charset=UTF-8\r\n";
    $headers .= "From: noreply@uitm-tapah.edu.my\r\n";

    $space_name = $booking_details['space_name'] ?? 'N/A';
    $event_name = $booking_details['event_name'] ?? 'N/A';
    $start_date = $booking_details['start_date'] ?? 'N/A';
    $end_date = $booking_details['end_date'] ?? 'N/A';

    if ($status === 'Approved') {
        $subject = "✓ Your Booking Request Has Been Approved - UiTM Tapah BSU";
        $message = "
            <html><body style='font-family: Arial, sans-serif;'>
            <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
                <h2 style='color: #10B981;'>Booking Approved ✓</h2>
                <p>Dear <strong>$user_name</strong>,</p>
                <p>We're pleased to inform you that your space booking request has been <strong style='color: #10B981;'>APPROVED</strong>.</p>
                <div style='background: #F0FDF4; border-left: 4px solid #10B981; padding: 15px; margin: 15px 0;'>
                    <p><strong>Booking Details:</strong></p>
                    <ul style='margin: 10px 0;'>
                        <li><strong>Event:</strong> $event_name</li>
                        <li><strong>Space:</strong> $space_name</li>
                        <li><strong>Start Date:</strong> $start_date</li>
                        <li><strong>End Date:</strong> $end_date</li>
                    </ul>
                </div>
                <p>You can now proceed with your booking. Please contact the moderator if you have any questions.</p>
                <p>Thank you for using UiTM Tapah BSU Booking System.</p>
                <p style='color: #6B7280; font-size: 12px; margin-top: 30px;'>This is an automated email. Please do not reply directly.</p>
            </div>
            </body></html>
        ";
    } else if ($status === 'Rejected') {
        $subject = "✗ Your Booking Request Has Been Rejected - UiTM Tapah BSU";
        $message = "
            <html><body style='font-family: Arial, sans-serif;'>
            <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
                <h2 style='color: #EF4444;'>Booking Rejected ✗</h2>
                <p>Dear <strong>$user_name</strong>,</p>
                <p>Unfortunately, your space booking request has been <strong style='color: #EF4444;'>REJECTED</strong>.</p>
                <div style='background: #FEF2F2; border-left: 4px solid #EF4444; padding: 15px; margin: 15px 0;'>
                    <p><strong>Booking Details:</strong></p>
                    <ul style='margin: 10px 0;'>
                        <li><strong>Event:</strong> $event_name</li>
                        <li><strong>Space:</strong> $space_name</li>
                        <li><strong>Requested Date:</strong> $start_date to $end_date</li>
                    </ul>
                    " . (!empty($notes) ? "<p><strong>Reason:</strong> $notes</p>" : "") . "
                </div>
                <p>Please contact the moderator or try booking a different space/time.</p>
                <p>Thank you for using UiTM Tapah BSU Booking System.</p>
                <p style='color: #6B7280; font-size: 12px; margin-top: 30px;'>This is an automated email. Please do not reply directly.</p>
            </div>
            </body></html>
        ";
    }

    if (!empty($subject) && !empty($message)) {
        return mail($to, $subject, $message, $headers);
    }
    return false;
}
?>
