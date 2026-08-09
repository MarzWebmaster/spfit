-- Add asset type and pairing relationship columns

ALTER TABLE assets
  ADD COLUMN asset_type VARCHAR(30) NOT NULL DEFAULT 'Lain-lain' AFTER name;

ALTER TABLE assets
  ADD COLUMN paired_asset_id INT NULL AFTER asset_type;

ALTER TABLE assets
  ADD INDEX idx_assets_asset_type (asset_type);

ALTER TABLE assets
  ADD INDEX idx_assets_paired_asset_id (paired_asset_id);

ALTER TABLE assets
  ADD CONSTRAINT fk_assets_paired_asset_id
  FOREIGN KEY (paired_asset_id) REFERENCES assets(id)
  ON DELETE SET NULL;
