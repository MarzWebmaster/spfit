-- SPFIT System Database Schema
-- Initial migration script

-- Create roles table
CREATE TABLE IF NOT EXISTS `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL UNIQUE,
  `description` text,
  `is_system_role` boolean DEFAULT false,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_roles_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `permission` varchar(100) NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE,
  INDEX `idx_role_permissions_role_id` (`role_id`),
  INDEX `idx_role_permissions_permission` (`permission`),
  UNIQUE KEY `unique_role_permission` (`role_id`, `permission`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create users table
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `role_id` int NOT NULL,
  `email` varchar(255) NOT NULL UNIQUE,
  `password_hash` varchar(255) NOT NULL,
  `status` enum('active', 'inactive', 'banned') DEFAULT 'active',
  `ban_reason` text,
  `phone` varchar(20),
  `ic_number` varchar(20),
  `experience` text,
  `rating` decimal(3,2) DEFAULT 0.00,
  `is_available` boolean DEFAULT true,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`),
  INDEX `idx_users_email` (`email`),
  INDEX `idx_users_role_id` (`role_id`),
  INDEX `idx_users_status` (`status`),
  INDEX `idx_users_rating` (`rating`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create freelancer_locations table
CREATE TABLE IF NOT EXISTS `freelancer_locations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `district` varchar(100) NOT NULL,
  `state` varchar(50) NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_freelancer_locations_user_id` (`user_id`),
  INDEX `idx_freelancer_locations_state` (`state`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create freelancer_skills table
CREATE TABLE IF NOT EXISTS `freelancer_skills` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `skill` varchar(100) NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_freelancer_skills_user_id` (`user_id`),
  INDEX `idx_freelancer_skills_skill` (`skill`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create tasks table
CREATE TABLE IF NOT EXISTS `tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `log_number` varchar(50) NOT NULL UNIQUE,
  `description` text NOT NULL,
  `support_type` varchar(100) NOT NULL,
  `client_location` varchar(255) NOT NULL,
  `state` varchar(50) NOT NULL,
  `deadline` date NOT NULL,
  `offer_price` decimal(10,2) NOT NULL,
  `status` enum('Baru', 'Tawaran Dihantar', 'Telah Diambil', 'Selesai', 'Borang Disemak & Pembayaran Tertunggak', 'Telah Dibayar', 'Dibatalkan', 'Selesai Penuh') DEFAULT 'Baru',
  `created_by` int NOT NULL,
  `assigned_to` int NULL,
  `remarks` text,
  `payment_date` date,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`),
  FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`),
  INDEX `idx_tasks_log_number` (`log_number`),
  INDEX `idx_tasks_support_type` (`support_type`),
  INDEX `idx_tasks_state` (`state`),
  INDEX `idx_tasks_status` (`status`),
  INDEX `idx_tasks_created_by` (`created_by`),
  INDEX `idx_tasks_assigned_to` (`assigned_to`),
  INDEX `idx_tasks_deadline` (`deadline`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create task_attachments table
CREATE TABLE IF NOT EXISTS `task_attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_type` varchar(50),
  `file_size` int,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  INDEX `idx_task_attachments_task_id` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create task_links table
CREATE TABLE IF NOT EXISTS `task_links` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `url` varchar(500) NOT NULL,
  `description` varchar(255),
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  INDEX `idx_task_links_task_id` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create task_reports table
CREATE TABLE IF NOT EXISTS `task_reports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL UNIQUE,
  `file_url` varchar(500),
  `notes` text,
  `submitted_at` timestamp NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create task_feedback table
CREATE TABLE IF NOT EXISTS `task_feedback` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL UNIQUE,
  `skill_rating` int NOT NULL CHECK (`skill_rating` >= 1 AND `skill_rating` <= 5),
  `communication_rating` int NOT NULL CHECK (`communication_rating` >= 1 AND `communication_rating` <= 5),
  `time_punctuality_rating` int NOT NULL CHECK (`time_punctuality_rating` >= 1 AND `time_punctuality_rating` <= 5),
  `response_time_rating` int NOT NULL CHECK (`response_time_rating` >= 1 AND `response_time_rating` <= 5),
  `overall_rating` int NOT NULL CHECK (`overall_rating` >= 1 AND `overall_rating` <= 5),
  `comment` text,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create notifications table
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `task_id` int,
  `type` enum('task_created', 'task_assigned', 'task_completed', 'task_cancelled', 'payment_received', 'report_submitted', 'feedback_received', 'system_announcement') NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `is_read` boolean DEFAULT false,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  INDEX `idx_notifications_user_id` (`user_id`),
  INDEX `idx_notifications_task_id` (`task_id`),
  INDEX `idx_notifications_is_read` (`is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `activity_type` enum('login', 'logout', 'task_created', 'task_updated', 'task_assigned', 'task_completed', 'task_cancelled', 'report_submitted', 'feedback_submitted', 'profile_updated', 'password_changed', 'system_access') NOT NULL,
  `description` varchar(255) NOT NULL,
  `ip_address` varchar(45),
  `user_agent` text,
  `metadata` json,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_activity_logs_user_id` (`user_id`),
  INDEX `idx_activity_logs_activity_type` (`activity_type`),
  INDEX `idx_activity_logs_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create system_settings table
CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL UNIQUE,
  `setting_value` text NOT NULL,
  `description` varchar(255),
  `data_type` varchar(50) DEFAULT 'string',
  `is_active` boolean DEFAULT true,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_system_settings_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert initial roles (ignore if already exists)
INSERT IGNORE INTO `roles` (`name`, `description`, `is_system_role`) VALUES
('Admin', 'System Administrator with full access', true),
('Staff', 'Staff member with task management access', true),
('Supervisor', 'Supervisor with oversight and approval access', true),
('Freelancer', 'Freelancer with task execution access', true);

-- Insert role permissions (ignore if already exists)
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission`) VALUES
-- Admin permissions
(1, 'users.create'),
(1, 'users.read'),
(1, 'users.update'),
(1, 'users.delete'),
(1, 'tasks.create'),
(1, 'tasks.read'),
(1, 'tasks.update'),
(1, 'tasks.delete'),
(1, 'reports.read'),
(1, 'settings.read'),
(1, 'settings.update'),
(1, 'system.admin'),
-- Staff permissions
(2, 'tasks.create'),
(2, 'tasks.read'),
(2, 'tasks.update'),
(2, 'freelancers.read'),
(2, 'reports.read'),
-- Supervisor permissions
(3, 'tasks.read'),
(3, 'tasks.approve'),
(3, 'freelancers.read'),
(3, 'reports.read'),
(3, 'reports.approve'),
-- Freelancer permissions
(4, 'tasks.read'),
(4, 'tasks.apply'),
(4, 'tasks.submit'),
(4, 'profile.update');

-- Insert default admin user (password: admin123) (ignore if already exists)
INSERT IGNORE INTO `users` (`name`, `role_id`, `email`, `password_hash`, `status`) VALUES
('System Administrator', 1, 'admin@spfit.com', '$2a$12$tHavYAXwJXWy6mL0RQh6x.bDaRI0eTe2C2GUlbHsh60jC4tF3/b3i', 'Aktif');

-- Insert system settings (ignore if already exists)
INSERT IGNORE INTO `system_settings` (`setting_key`, `setting_value`, `description`, `data_type`) VALUES
('site_name', 'SPFIT - Sistem Pengurusan Freelance IT Tech', 'Application name', 'string'),
('site_description', 'Sistem pengurusan tugasan freelancer IT dan teknologi', 'Application description', 'string'),
('max_file_size', '10485760', 'Maximum file upload size in bytes (10MB)', 'number'),
('allowed_file_types', 'pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,jpeg,png,gif,zip,rar', 'Allowed file extensions for upload', 'string'),
('email_notifications', 'true', 'Enable email notifications', 'boolean'),
('task_auto_assignment', 'false', 'Enable automatic task assignment', 'boolean'),
('freelancer_rating_required', 'true', 'Require rating after task completion', 'boolean'),
('system_maintenance', 'false', 'System maintenance mode', 'boolean');