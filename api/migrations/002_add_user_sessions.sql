-- Create user_sessions table for storing active authentication sessions
CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token_hash` varchar(500) NOT NULL UNIQUE,
  `ip_address` varchar(45),
  `user_agent` text,
  `expires_at` timestamp NOT NULL,
  `is_active` boolean DEFAULT true,
  `last_activity` timestamp NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_sessions_user_id` (`user_id`),
  INDEX `idx_user_sessions_token_hash` (`token_hash`),
  INDEX `idx_user_sessions_is_active` (`is_active`),
  INDEX `idx_user_sessions_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clean up any expired sessions (optional cleanup)
DELETE FROM `user_sessions` WHERE `expires_at` < NOW() OR `is_active` = false;