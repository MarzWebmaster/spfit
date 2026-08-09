-- Migration: Add audit_trails table
-- Date: 2026-02-03

CREATE TABLE IF NOT EXISTS `audit_trails` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NULL,
  `action_type` VARCHAR(50) NOT NULL,
  `table_name` VARCHAR(100) NOT NULL,
  `record_id` INT NULL,
  `old_values` JSON NULL,
  `new_values` JSON NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  `description` TEXT NULL,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_audit_trails_user_id` (`user_id`),
  INDEX `idx_audit_trails_table_name` (`table_name`),
  INDEX `idx_audit_trails_action_type` (`action_type`),
  INDEX `idx_audit_trails_timestamp` (`timestamp`),
  CONSTRAINT `fk_audit_trails_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
