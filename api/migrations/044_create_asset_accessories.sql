CREATE TABLE IF NOT EXISTS asset_accessories (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  asset_id INT NOT NULL,
  accessory_asset_id INT NOT NULL,
  accessory_type VARCHAR(30) NOT NULL,
  notes VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_asset_accessories_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  CONSTRAINT fk_asset_accessories_accessory FOREIGN KEY (accessory_asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  UNIQUE KEY uq_asset_accessories_asset_accessory (asset_id, accessory_asset_id),
  KEY idx_asset_accessories_asset_id (asset_id),
  KEY idx_asset_accessories_accessory_asset_id (accessory_asset_id),
  KEY idx_asset_accessories_type (accessory_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

