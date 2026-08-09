CREATE TABLE IF NOT EXISTS masterlist_assets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  masterlist_id INT NOT NULL,
  asset_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_masterlist_assets_masterlist_asset (masterlist_id, asset_id),
  KEY idx_masterlist_assets_masterlist (masterlist_id),
  KEY idx_masterlist_assets_asset (asset_id),
  CONSTRAINT fk_masterlist_assets_masterlist
    FOREIGN KEY (masterlist_id) REFERENCES masterlists(id) ON DELETE CASCADE,
  CONSTRAINT fk_masterlist_assets_asset
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

