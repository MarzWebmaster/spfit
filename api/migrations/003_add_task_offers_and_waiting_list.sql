-- Migration: Add task_offers and task_waiting_list tables
-- Date: 2026-01-07

CREATE TABLE IF NOT EXISTS `task_offers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `task_id` INT NOT NULL,
  `freelancer_id` INT NOT NULL,
  `token` VARCHAR(255) NOT NULL UNIQUE,
  `status` ENUM('pending', 'accepted', 'rejected', 'expired') NOT NULL DEFAULT 'pending',
  `responded_at` DATETIME NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_task_offers_task_id` (`task_id`),
  INDEX `idx_task_offers_freelancer_id` (`freelancer_id`),
  INDEX `idx_task_offers_token` (`token`),
  INDEX `idx_task_offers_status` (`status`),
  CONSTRAINT `fk_task_offers_task` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_task_offers_freelancer` FOREIGN KEY (`freelancer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `task_waiting_list` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `task_id` INT NOT NULL,
  `freelancer_id` INT NOT NULL,
  `position` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_task_waiting_list_task_id` (`task_id`),
  INDEX `idx_task_waiting_list_freelancer_id` (`freelancer_id`),
  CONSTRAINT `fk_task_waiting_list_task` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_task_waiting_list_freelancer` FOREIGN KEY (`freelancer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
