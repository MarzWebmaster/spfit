-- Add department column to asset_users table if it does not already exist

SET @asset_users_has_department := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'asset_users'
    AND COLUMN_NAME = 'department'
);

SET @sql_add_asset_users_department := IF(
  @asset_users_has_department = 0,
  'ALTER TABLE asset_users ADD COLUMN department VARCHAR(150) NULL AFTER position',
  'SELECT 1'
);
PREPARE stmt_add_asset_users_department FROM @sql_add_asset_users_department;
EXECUTE stmt_add_asset_users_department;
DEALLOCATE PREPARE stmt_add_asset_users_department;

SET @asset_users_has_department_index := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'asset_users'
    AND INDEX_NAME = 'idx_asset_users_department'
);

SET @sql_add_asset_users_department_index := IF(
  @asset_users_has_department_index = 0,
  'ALTER TABLE asset_users ADD INDEX idx_asset_users_department (department)',
  'SELECT 1'
);
PREPARE stmt_add_asset_users_department_index FROM @sql_add_asset_users_department_index;
EXECUTE stmt_add_asset_users_department_index;
DEALLOCATE PREPARE stmt_add_asset_users_department_index;