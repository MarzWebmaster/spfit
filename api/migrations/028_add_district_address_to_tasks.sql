SET @tasks_has_district_address := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tasks'
    AND COLUMN_NAME = 'district_address'
);

SET @sql_add_tasks_district_address := IF(
  @tasks_has_district_address = 0,
  'ALTER TABLE tasks ADD COLUMN district_address VARCHAR(255) NULL AFTER client_location',
  'SELECT 1'
);

PREPARE stmt_add_tasks_district_address FROM @sql_add_tasks_district_address;
EXECUTE stmt_add_tasks_district_address;
DEALLOCATE PREPARE stmt_add_tasks_district_address;
