SET @support_types_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'support_types'
);
SET @task_support_types_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'task_support_types'
);
SET @sql := IF(
  @support_types_exists > 0 AND @task_support_types_exists = 0,
  'RENAME TABLE support_types TO task_support_types',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @equipment_codes_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'equipment_codes'
);
SET @task_equipment_codes_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'task_equipment_codes'
);
SET @sql := IF(
  @equipment_codes_exists > 0 AND @task_equipment_codes_exists = 0,
  'RENAME TABLE equipment_codes TO task_equipment_codes',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND column_name = 'status_setting_id'
);
SET @new_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND column_name = 'status_id'
);
SET @sql := IF(
  @col_exists > 0 AND @new_col_exists = 0,
  'ALTER TABLE tasks CHANGE COLUMN status_setting_id status_id INT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'tasks'
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name = 'fk_tasks_status_setting_id'
);
SET @sql := IF(
  @fk_exists > 0,
  'ALTER TABLE tasks DROP FOREIGN KEY fk_tasks_status_setting_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @legacy_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND column_name = 'status_setting_id'
);
SET @new_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND column_name = 'status_id'
);
SET @sql := IF(
  @legacy_col_exists > 0 AND @new_col_exists > 0,
  'ALTER TABLE tasks DROP COLUMN status_setting_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'tasks'
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name = 'fk_tasks_support_type_setting_id'
);
SET @sql := IF(
  @fk_exists > 0,
  'ALTER TABLE tasks DROP FOREIGN KEY fk_tasks_support_type_setting_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND column_name = 'support_type_setting_id'
);
SET @new_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND column_name = 'support_type_id'
);
SET @sql := IF(
  @col_exists > 0 AND @new_col_exists = 0,
  'ALTER TABLE tasks CHANGE COLUMN support_type_setting_id support_type_id INT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @legacy_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND column_name = 'support_type_setting_id'
);
SET @new_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND column_name = 'support_type_id'
);
SET @sql := IF(
  @legacy_col_exists > 0 AND @new_col_exists > 0,
  'ALTER TABLE tasks DROP COLUMN support_type_setting_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND column_name = 'equipment_types'
);
SET @new_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND column_name = 'equipment_types_id'
);
SET @sql := IF(
  @col_exists > 0 AND @new_col_exists = 0,
  'ALTER TABLE tasks CHANGE COLUMN equipment_types equipment_types_id JSON NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @legacy_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND column_name = 'equipment_types'
);
SET @new_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND column_name = 'equipment_types_id'
);
SET @sql := IF(
  @legacy_col_exists > 0 AND @new_col_exists > 0,
  'ALTER TABLE tasks DROP COLUMN equipment_types',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @new_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND column_name = 'equipment_types_id'
);
SET @sql := IF(
  @new_col_exists = 0,
  'ALTER TABLE tasks ADD COLUMN equipment_types_id JSON NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @status_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND column_name = 'status'
);
SET @sql := IF(
  @status_col_exists > 0,
  'ALTER TABLE tasks DROP COLUMN status',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND index_name = 'idx_tasks_status_id'
);
SET @sql := IF(
  @idx_exists = 0,
  'ALTER TABLE tasks ADD INDEX idx_tasks_status_id (status_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND index_name = 'idx_tasks_support_type_id'
);
SET @sql := IF(
  @idx_exists = 0,
  'ALTER TABLE tasks ADD INDEX idx_tasks_support_type_id (support_type_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE tasks t
SET equipment_types_id = (
  SELECT JSON_ARRAYAGG(ec.id)
  FROM task_equipment_codes ec
  WHERE JSON_CONTAINS(t.equipment_types_id, JSON_QUOTE(ec.code), '$')
)
WHERE equipment_types_id IS NOT NULL
  AND JSON_VALID(equipment_types_id)
  AND JSON_TYPE(JSON_EXTRACT(equipment_types_id, '$[0]')) = 'STRING';

SET @support_types_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'support_types'
);
SET @task_support_types_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'task_support_types'
);
SET @sql := IF(
  @support_types_exists > 0 AND @task_support_types_exists > 0,
  'DROP TABLE support_types',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @equipment_codes_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'equipment_codes'
);
SET @task_equipment_codes_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'task_equipment_codes'
);
SET @sql := IF(
  @equipment_codes_exists > 0 AND @task_equipment_codes_exists > 0,
  'DROP TABLE equipment_codes',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;