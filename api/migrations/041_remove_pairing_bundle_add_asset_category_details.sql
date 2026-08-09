DROP TABLE IF EXISTS asset_bundle_members;
DROP TABLE IF EXISTS asset_bundles;

ALTER TABLE assets
  DROP FOREIGN KEY fk_assets_paired_asset_id;

ALTER TABLE assets
  DROP INDEX idx_assets_paired_asset_id;

ALTER TABLE assets
  DROP COLUMN paired_asset_id;

CREATE TABLE IF NOT EXISTS asset_desktops (
  asset_id INT NOT NULL PRIMARY KEY,
  monitor VARCHAR(255) NULL,
  keyboard VARCHAR(255) NULL,
  mouse VARCHAR(255) NULL,
  other_hardware TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_asset_desktops_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  KEY idx_asset_desktops_asset_id (asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS asset_laptops (
  asset_id INT NOT NULL PRIMARY KEY,
  mouse VARCHAR(255) NULL,
  other_hardware TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_asset_laptops_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  KEY idx_asset_laptops_asset_id (asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS asset_printers (
  asset_id INT NOT NULL PRIMARY KEY,
  other_hardware TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_asset_printers_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  KEY idx_asset_printers_asset_id (asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS asset_monitors (
  asset_id INT NOT NULL PRIMARY KEY,
  other_hardware TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_asset_monitors_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  KEY idx_asset_monitors_asset_id (asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
