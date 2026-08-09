-- Normalize role types to exactly 4 canonical values and align existing roles

-- 1) Map existing roles to canonical role_type_id by current role type names (legacy BM/EN)
UPDATE `roles` r
JOIN `role_types` rt ON r.`role_type_id` = rt.`id`
SET r.`role_type_id` = CASE
  WHEN rt.`name` IN ('Admin', 'Pentadbiran') THEN 1
  WHEN rt.`name` IN ('Management', 'Pengurusan') THEN 2
  WHEN rt.`name` IN ('Associate Partner', 'Operasi') THEN 3
  WHEN rt.`name` IN ('Freelancer', 'Luaran') THEN 4
  ELSE r.`role_type_id`
END;

-- 2) Normalize role name variant
UPDATE `roles`
SET `name` = 'Freelancer'
WHERE `name` = 'Freelance Tech';

-- 3) Enforce canonical mapping by role name
UPDATE `roles` SET `role_type_id` = 1 WHERE `name` = 'Admin';
UPDATE `roles` SET `role_type_id` = 2 WHERE `name` = 'Staff';
UPDATE `roles` SET `role_type_id` = 3 WHERE `name` = 'Supervisor';
UPDATE `roles` SET `role_type_id` = 4 WHERE `name` = 'Freelancer';

-- 4) Safety fallback for invalid/null role type assignments
UPDATE `roles`
SET `role_type_id` = 3
WHERE `role_type_id` IS NULL OR `role_type_id` NOT IN (1, 2, 3, 4);

-- 5) Rename non-canonical role_types first to avoid unique name conflicts during upsert
UPDATE `role_types`
SET `name` = LEFT(CONCAT(`name`, '_legacy_', `id`), 50)
WHERE `id` NOT IN (1, 2, 3, 4);

-- 6) Upsert canonical role types (fixed IDs and labels)
INSERT INTO `role_types` (`id`, `name`, `description`) VALUES
(1, 'Admin', 'Administrative'),
(2, 'Management', 'Management'),
(3, 'Associate Partner', 'Operational'),
(4, 'Freelancer', 'External')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`);

-- 7) Remove all extra role types
DELETE FROM `role_types`
WHERE `id` NOT IN (1, 2, 3, 4);
