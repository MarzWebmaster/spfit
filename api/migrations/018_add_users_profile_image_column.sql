-- Ensure users.profile_image exists for User entity compatibility
SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'profile_image'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE users ADD COLUMN profile_image VARCHAR(255) NULL AFTER is_available',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
