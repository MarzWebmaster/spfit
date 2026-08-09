-- Add asset_users table to link assets with user information
-- Rename location column to 'group' in assets table

-- Step 1: Rename location to group in assets table
SET @assets_has_location := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets'
    AND COLUMN_NAME = 'location'
);

SET @assets_has_group := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets'
    AND COLUMN_NAME = 'group'
);

SET @sql_rename_location := IF(
  @assets_has_location = 1 AND @assets_has_group = 0,
  'ALTER TABLE assets CHANGE COLUMN location `group` VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt_rename_location FROM @sql_rename_location;
EXECUTE stmt_rename_location;
DEALLOCATE PREPARE stmt_rename_location;

-- Step 2: Create asset_users table
SET @asset_users_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'asset_users'
);

SET @sql_create_asset_users := IF(
  @asset_users_exists = 0,
  'CREATE TABLE asset_users (
    id INT NOT NULL AUTO_INCREMENT,
    asset_id INT NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    position VARCHAR(100),
    floor VARCHAR(50),
    building VARCHAR(100),
    location VARCHAR(255),
    branch VARCHAR(100),
    state VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_asset_id_user_name (asset_id, user_name),
    KEY idx_asset_users_asset_id (asset_id),
    KEY idx_asset_users_user_name (user_name),
    KEY idx_asset_users_position (position),
    KEY idx_asset_users_branch (branch),
    CONSTRAINT fk_asset_users_asset_id FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
  'SELECT 1'
);
PREPARE stmt_create_asset_users FROM @sql_create_asset_users;
EXECUTE stmt_create_asset_users;
DEALLOCATE PREPARE stmt_create_asset_users;
