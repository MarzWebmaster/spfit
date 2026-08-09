-- 1) Tambah column updated_by ke jadual assets
SET @exist_updated_by := (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE table_schema = DATABASE() AND table_name = 'assets' AND column_name = 'updated_by');

SET @sql_add_updated_by = IF(@exist_updated_by = 0,
  'ALTER TABLE assets ADD COLUMN updated_by INT NULL AFTER created_by, ADD CONSTRAINT fk_assets_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL, ADD INDEX idx_assets_updated_by (updated_by)',
  'SELECT "Column updated_by already exists on assets"');

PREPARE stmt FROM @sql_add_updated_by;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Cipta jadual asset_update_logs untuk rekod audit setiap kemaskini aset
CREATE TABLE IF NOT EXISTS asset_update_logs (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  asset_id INT NOT NULL,
  user_id INT NULL,
  action_type VARCHAR(30) NOT NULL COMMENT 'CREATE, UPDATE, DELETE, STATUS_CHANGE',
  field_changes JSON NULL COMMENT 'Perubahan field yang dibuat',
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_asset_update_logs_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  CONSTRAINT fk_asset_update_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_asset_update_logs_asset (asset_id),
  KEY idx_asset_update_logs_user (user_id),
  KEY idx_asset_update_logs_action (action_type),
  KEY idx_asset_update_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
