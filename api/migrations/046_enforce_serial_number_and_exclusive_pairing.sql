-- 1) Kemaskini serial_number sedia ada yang NULL atau kosong
UPDATE assets 
SET serial_number = CONCAT('S/N-UNASSIGNED-', id) 
WHERE serial_number IS NULL OR TRIM(serial_number) = '';

-- 2) Tukar column serial_number kepada NOT NULL
ALTER TABLE assets 
MODIFY COLUMN serial_number VARCHAR(120) NOT NULL;

-- 3) Tambah UNIQUE constraint ke atas accessory_asset_id untuk exclusive pairing
SET @exist_acc_idx := (SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema = DATABASE() AND table_name = 'asset_accessories' AND index_name = 'uq_asset_accessories_accessory');

SET @sql_add_acc_idx = IF(@exist_acc_idx = 0,
  'ALTER TABLE asset_accessories ADD UNIQUE INDEX uq_asset_accessories_accessory (accessory_asset_id)',
  'SELECT "Index uq_asset_accessories_accessory already exists"');

PREPARE stmt FROM @sql_add_acc_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4) Cipta jadual asset_pairing_history untuk audit report (PAIR/UNPAIR)
CREATE TABLE IF NOT EXISTS asset_pairing_history (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  parent_asset_id INT NOT NULL,
  accessory_asset_id INT NOT NULL,
  action ENUM('PAIRED', 'UNPAIRED') NOT NULL,
  action_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pairing_history_parent FOREIGN KEY (parent_asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  CONSTRAINT fk_pairing_history_accessory FOREIGN KEY (accessory_asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  CONSTRAINT fk_pairing_history_user FOREIGN KEY (action_by) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_pairing_history_parent (parent_asset_id),
  KEY idx_pairing_history_accessory (accessory_asset_id),
  KEY idx_pairing_history_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
