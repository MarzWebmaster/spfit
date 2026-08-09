-- Create masterlists table
CREATE TABLE IF NOT EXISTS masterlists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Aktif',
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_masterlists_project_code (project_id, code),
  INDEX idx_masterlists_project_id (project_id),
  INDEX idx_masterlists_status (status),
  INDEX idx_masterlists_created_by (created_by),
  CONSTRAINT fk_masterlists_project_id FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_masterlists_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Ensure schema on existing DBs (idempotent)
SET @masterlists_has_code := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'masterlists'
    AND COLUMN_NAME = 'code'
);
SET @sql_masterlists_code := IF(
  @masterlists_has_code = 0,
  'ALTER TABLE masterlists ADD COLUMN code VARCHAR(50) NOT NULL AFTER project_id',
  'SELECT 1'
);
PREPARE stmt_masterlists_code FROM @sql_masterlists_code;
EXECUTE stmt_masterlists_code;
DEALLOCATE PREPARE stmt_masterlists_code;

SET @masterlists_has_status := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'masterlists'
    AND COLUMN_NAME = 'status'
);
SET @sql_masterlists_status := IF(
  @masterlists_has_status = 0,
  "ALTER TABLE masterlists ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'Aktif' AFTER description",
  'SELECT 1'
);
PREPARE stmt_masterlists_status FROM @sql_masterlists_status;
EXECUTE stmt_masterlists_status;
DEALLOCATE PREPARE stmt_masterlists_status;

SET @masterlists_has_uq_code := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'masterlists'
    AND INDEX_NAME = 'uq_masterlists_project_code'
);
SET @sql_masterlists_uq_code := IF(
  @masterlists_has_uq_code = 0,
  'ALTER TABLE masterlists ADD UNIQUE KEY uq_masterlists_project_code (project_id, code)',
  'SELECT 1'
);
PREPARE stmt_masterlists_uq_code FROM @sql_masterlists_uq_code;
EXECUTE stmt_masterlists_uq_code;
DEALLOCATE PREPARE stmt_masterlists_uq_code;

-- Create assets table
CREATE TABLE IF NOT EXISTS assets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  masterlist_id INT NOT NULL,
  asset_tag VARCHAR(100) NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NULL,
  brand VARCHAR(100) NULL,
  model VARCHAR(100) NULL,
  serial_number VARCHAR(120) NULL,
  location VARCHAR(255) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Aktif',
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_assets_masterlist_id (masterlist_id),
  INDEX idx_assets_asset_tag (asset_tag),
  INDEX idx_assets_status (status),
  INDEX idx_assets_created_by (created_by),
  CONSTRAINT fk_assets_masterlist_id FOREIGN KEY (masterlist_id) REFERENCES masterlists(id) ON DELETE CASCADE,
  CONSTRAINT fk_assets_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Ensure schema on existing DBs (idempotent)
SET @assets_has_asset_tag := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets'
    AND COLUMN_NAME = 'asset_tag'
);
SET @sql_assets_asset_tag := IF(
  @assets_has_asset_tag = 0,
  'ALTER TABLE assets ADD COLUMN asset_tag VARCHAR(100) NULL AFTER masterlist_id',
  'SELECT 1'
);
PREPARE stmt_assets_asset_tag FROM @sql_assets_asset_tag;
EXECUTE stmt_assets_asset_tag;
DEALLOCATE PREPARE stmt_assets_asset_tag;

SET @assets_has_name := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets'
    AND COLUMN_NAME = 'name'
);
SET @sql_assets_name := IF(
  @assets_has_name = 0,
  'ALTER TABLE assets ADD COLUMN name VARCHAR(255) NOT NULL AFTER asset_tag',
  'SELECT 1'
);
PREPARE stmt_assets_name FROM @sql_assets_name;
EXECUTE stmt_assets_name;
DEALLOCATE PREPARE stmt_assets_name;

SET @assets_has_status := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets'
    AND COLUMN_NAME = 'status'
);
SET @sql_assets_status := IF(
  @assets_has_status = 0,
  "ALTER TABLE assets ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'Aktif' AFTER location",
  'SELECT 1'
);
PREPARE stmt_assets_status FROM @sql_assets_status;
EXECUTE stmt_assets_status;
DEALLOCATE PREPARE stmt_assets_status;
