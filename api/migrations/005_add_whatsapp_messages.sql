-- Migration: Add whatsapp_messages table for queue and delivery tracking
-- Date: 2026-02-06

CREATE TABLE IF NOT EXISTS `whatsapp_messages` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `to` VARCHAR(30) NOT NULL,
  `message` TEXT NULL,
  `template_name` VARCHAR(100) NULL,
  `template_params` JSON NULL,
  `status` ENUM('queued','sending','sent','delivered','failed','expired') NOT NULL DEFAULT 'queued',
  `attempts` INT NOT NULL DEFAULT 0,
  `last_error` TEXT NULL,
  `provider_message_id` VARCHAR(100) NULL,
  `correlation_id` VARCHAR(100) NULL,
  `queued_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_at` DATETIME NULL,
  `delivered_at` DATETIME NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_whatsapp_status` (`status`),
  INDEX `idx_whatsapp_to` (`to`),
  INDEX `idx_whatsapp_provider_id` (`provider_message_id`),
  INDEX `idx_whatsapp_corr` (`correlation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
