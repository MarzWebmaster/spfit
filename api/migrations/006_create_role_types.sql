CREATE TABLE IF NOT EXISTS `role_types` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL UNIQUE,
  `description` VARCHAR(100),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `role_types` (`name`, `description`) VALUES
('Pentadbiran', 'Administrative'),
('Pengurusan', 'Management'),
('Operasi', 'Operational'),
('Luaran', 'External');

ALTER TABLE `roles` ADD COLUMN `role_type_id` INT;

UPDATE `roles` r JOIN `role_types` rt ON r.role_type = rt.name SET r.role_type_id = rt.id;

UPDATE `roles` SET `role_type_id` = (SELECT id FROM `role_types` WHERE name = 'Operasi') WHERE `role_type_id` IS NULL;

ALTER TABLE `roles` ADD CONSTRAINT `fk_roles_role_type` FOREIGN KEY (`role_type_id`) REFERENCES `role_types`(`id`);

ALTER TABLE `roles` DROP COLUMN `role_type`;
