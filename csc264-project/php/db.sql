-- =====================================================
-- BSU SPACE BOOKING SYSTEM — DATABASE SCHEMA
-- UiTM Cawangan Perak, Kampus Tapah
-- =====================================================
-- ERD tables: USER / STUDENT / STAFF / SPACE / RESERVATION /
--             SPACE_RESERVATION / NOTIFICATION (+ PAYMENT, ADMIN_LOGS)
-- =====================================================

CREATE DATABASE IF NOT EXISTS `bsu_space_booking`
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `bsu_space_booking`;

-- =====================================================
-- USER (general entity)
-- =====================================================
CREATE TABLE IF NOT EXISTS `user` (
    `user_id`       INT PRIMARY KEY AUTO_INCREMENT,
    `name`          VARCHAR(255) NOT NULL,
    `email`         VARCHAR(255) UNIQUE NOT NULL,
    `password`      VARCHAR(255) NOT NULL,
    `contact_no`    VARCHAR(20),
    `campus`        VARCHAR(100) DEFAULT 'UITM Kampus Tapah',
    `user_category` ENUM('Student','Staff','Admin') DEFAULT 'Student',
    `status`        ENUM('Active','Inactive') DEFAULT 'Active',
    `created_at`    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_email` (`email`),
    INDEX `idx_user_category` (`user_category`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- STUDENT (specialization of USER)
-- =====================================================
CREATE TABLE IF NOT EXISTS `student` (
    `user_id`     INT NOT NULL,
    `student_no`  VARCHAR(30) NOT NULL,
    `department`  VARCHAR(255),
    `program`     VARCHAR(255),
    PRIMARY KEY (`user_id`, `student_no`),
    UNIQUE KEY `uq_student_no` (`student_no`),
    FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`) ON DELETE CASCADE,
    INDEX `idx_student_no` (`student_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- STAFF (specialization of USER)
-- =====================================================
CREATE TABLE IF NOT EXISTS `staff` (
    `user_id`      INT NOT NULL,
    `staff_no`     VARCHAR(30) NOT NULL,
    `position`     VARCHAR(100),
    `permission`   ENUM('Moderator','Admin','SuperAdmin') DEFAULT 'Moderator',
    PRIMARY KEY (`user_id`, `staff_no`),
    UNIQUE KEY `uq_staff_no` (`staff_no`),
    FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`) ON DELETE CASCADE,
    INDEX `idx_staff_no` (`staff_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- SPACE (room / hall / lab / court)
-- Rich detail columns power the space-detail page.
-- Sensible UiTM Tapah defaults keep the seed compact.
-- =====================================================
CREATE TABLE IF NOT EXISTS `space` (
    `space_id`            INT PRIMARY KEY AUTO_INCREMENT,
    `space_code`          VARCHAR(50) UNIQUE NOT NULL,
    `space_name`          VARCHAR(255) NOT NULL,
    `moderator`           VARCHAR(255),
    `PIC`                 VARCHAR(255),
    `space_category`      VARCHAR(100) NOT NULL,
    `faculty`             VARCHAR(255) DEFAULT 'UITM CAWANGAN PERAK',
    `campus`              VARCHAR(100) DEFAULT 'UITM Kampus Tapah',
    `operation_time`      VARCHAR(100) DEFAULT '08:00 - 18:00',
    `seating_capacity`    INT DEFAULT 0,
    `hourly_rate`         DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    `rate_4hour`          DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    `rate_full_day`       DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    `facilities_list`     VARCHAR(500),
    `remark`              TEXT,
    `additional_info`     TEXT,
    `terms_conditions`    TEXT,
    `image_url`           VARCHAR(500),
    `is_active`           TINYINT(1) DEFAULT 1,
    `created_at`          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_space_category` (`space_category`),
    INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- RESERVATION (booking header)
-- =====================================================
CREATE TABLE IF NOT EXISTS `reservation` (
    `reservation_id`     INT PRIMARY KEY AUTO_INCREMENT,
    `user_id`            INT NOT NULL,
    `event`              VARCHAR(255) NOT NULL,
    `reservation_title`  VARCHAR(255),
    `no_participants`    INT DEFAULT 0,
    `start_date`         DATE NOT NULL,
    `end_date`           DATE NOT NULL,
    `start_time`         TIME,
    `end_time`           TIME,
    `apply_date`         DATE NOT NULL,
    `file_attachment`    VARCHAR(255),
    `created_at`         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at`         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`) ON DELETE CASCADE,
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_start_date` (`start_date`),
    INDEX `idx_apply_date` (`apply_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- SPACE_RESERVATION (associative entity + status)
-- =====================================================
CREATE TABLE IF NOT EXISTS `space_reservation` (
    `space_id`       INT NOT NULL,
    `reservation_id` INT NOT NULL,
    `status`         ENUM('Pending','Approved','In Progress','Rejected','Cancelled') DEFAULT 'Pending',
    `approval_date`  TIMESTAMP NULL DEFAULT NULL,
    `reviewed_by`    INT NULL,
    `review_notes`   TEXT,
    PRIMARY KEY (`space_id`, `reservation_id`),
    FOREIGN KEY (`space_id`) REFERENCES `space`(`space_id`) ON DELETE CASCADE,
    FOREIGN KEY (`reservation_id`) REFERENCES `reservation`(`reservation_id`) ON DELETE CASCADE,
    FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`user_id`) ON DELETE SET NULL,
    INDEX `idx_status` (`status`),
    INDEX `idx_approval_date` (`approval_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- PAYMENT (one row per paid reservation)
-- =====================================================
CREATE TABLE IF NOT EXISTS `payment` (
    `payment_id`     INT PRIMARY KEY AUTO_INCREMENT,
    `reservation_id` INT NOT NULL,
    `user_id`        INT NOT NULL,
    `amount`         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `method`         ENUM('FPX','TNG','Boost','Card','Cash') DEFAULT 'FPX',
    `bank_name`      VARCHAR(100) NULL,
    `card_last4`     VARCHAR(4) NULL,
    `bill_code`      VARCHAR(50) NULL,
    `reference_no`   VARCHAR(40) UNIQUE NOT NULL,
    `status`         ENUM('Pending','Paid','Failed','Refunded') DEFAULT 'Pending',
    `paid_at`        TIMESTAMP NULL DEFAULT NULL,
    `created_at`     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`reservation_id`) REFERENCES `reservation`(`reservation_id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`)        REFERENCES `user`(`user_id`)               ON DELETE CASCADE,
    INDEX `idx_reservation_id` (`reservation_id`),
    INDEX `idx_user_id`        (`user_id`),
    INDEX `idx_status`         (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- NOTIFICATION (in-app notifications)
-- =====================================================
CREATE TABLE IF NOT EXISTS `notification` (
    `notification_id` INT PRIMARY KEY AUTO_INCREMENT,
    `user_id`         INT NOT NULL,
    `type`            ENUM('approval','rejection','info','reminder','system') DEFAULT 'info',
    `title`           VARCHAR(255) NOT NULL,
    `message`         TEXT NOT NULL,
    `related_table`   VARCHAR(50),
    `related_id`      INT,
    `is_read`         TINYINT(1) DEFAULT 0,
    `created_at`      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `read_at`         TIMESTAMP NULL,
    FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`) ON DELETE CASCADE,
    INDEX `idx_user_unread` (`user_id`, `is_read`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- ADMIN_LOGS (audit trail)
-- =====================================================
CREATE TABLE IF NOT EXISTS `admin_logs` (
    `log_id`       INT PRIMARY KEY AUTO_INCREMENT,
    `admin_id`     INT NOT NULL,
    `action`       VARCHAR(100) NOT NULL,
    `target_table` VARCHAR(50),
    `target_id`    INT,
    `details`      JSON,
    `created_at`   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`admin_id`) REFERENCES `user`(`user_id`) ON DELETE CASCADE,
    INDEX `idx_admin_id` (`admin_id`),
    INDEX `idx_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- TABLE: password_reset  (forgot-password OTP flow)
-- =====================================================
CREATE TABLE IF NOT EXISTS `password_reset` (
    `id`          INT PRIMARY KEY AUTO_INCREMENT,
    `user_id`     INT NOT NULL,
    `email`       VARCHAR(150) NOT NULL,
    `otp_hash`    VARCHAR(255) NOT NULL,
    `reset_token` VARCHAR(64) DEFAULT NULL,
    `expires_at`  DATETIME NOT NULL,
    `attempts`    INT NOT NULL DEFAULT 0,
    `used`        TINYINT NOT NULL DEFAULT 0,
    `created_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_pr_email` (`email`),
    INDEX `idx_pr_token` (`reset_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- VIEW: users  (flat shape for legacy queries)
-- =====================================================
CREATE OR REPLACE VIEW `users` AS
SELECT
    u.user_id AS id,
    u.name AS full_name,
    COALESCE(s.student_no, st.staff_no) AS student_no,
    u.email,
    u.password,
    u.contact_no AS phone,
    u.campus,
    s.department AS faculty,
    s.program,
    CASE
        WHEN u.user_category = 'Student' THEN 'Student'
        WHEN st.permission = 'Admin' OR st.permission = 'SuperAdmin' THEN 'Admin'
        WHEN st.permission = 'Moderator' THEN 'Moderator'
        ELSE u.user_category
    END AS role,
    u.status,
    u.created_at,
    u.updated_at
FROM `user` u
LEFT JOIN `student` s ON s.user_id = u.user_id
LEFT JOIN `staff` st ON st.user_id = u.user_id;

-- =====================================================
-- VIEW: spaces  (exposes every detail column)
-- =====================================================
CREATE OR REPLACE VIEW `spaces` AS
SELECT
    space_id AS id,
    space_code,
    space_name,
    space_category AS category,
    campus,
    faculty AS department,
    operation_time,
    seating_capacity,
    hourly_rate,
    rate_4hour,
    rate_full_day,
    facilities_list,
    remark,
    additional_info,
    terms_conditions,
    image_url,
    moderator AS moderator_names,
    PIC AS person_incharge,
    is_active,
    created_at,
    updated_at
FROM `space`;

-- =====================================================
-- VIEW: bookings  (reservation + status + latest payment)
-- =====================================================
CREATE OR REPLACE VIEW `bookings` AS
SELECT
    r.reservation_id AS id,
    r.user_id,
    sr.space_id,
    r.reservation_title,
    r.event AS event_name,
    r.start_date,
    r.end_date,
    r.start_time,
    r.end_time,
    r.apply_date AS applied_date,
    r.no_participants AS total_participants,
    r.file_attachment,
    sr.status,
    sr.reviewed_by,
    sr.review_notes,
    sr.approval_date,
    r.created_at,
    r.updated_at,
    (SELECT p.payment_id   FROM payment p WHERE p.reservation_id = r.reservation_id ORDER BY p.payment_id DESC LIMIT 1) AS payment_id,
    (SELECT p.amount       FROM payment p WHERE p.reservation_id = r.reservation_id ORDER BY p.payment_id DESC LIMIT 1) AS payment_amount,
    (SELECT p.status       FROM payment p WHERE p.reservation_id = r.reservation_id ORDER BY p.payment_id DESC LIMIT 1) AS payment_status,
    (SELECT p.method       FROM payment p WHERE p.reservation_id = r.reservation_id ORDER BY p.payment_id DESC LIMIT 1) AS payment_method,
    (SELECT p.reference_no FROM payment p WHERE p.reservation_id = r.reservation_id ORDER BY p.payment_id DESC LIMIT 1) AS payment_reference
FROM `reservation` r
JOIN `space_reservation` sr ON sr.reservation_id = r.reservation_id;

-- =====================================================
-- END OF SCHEMA. Import seed_data.sql next, then run setup.php.
-- =====================================================
