-- Remove asset_type column (legacy pairing/bundle feature)

SET @assets_has_asset_type := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets'
    AND COLUMN_NAME = 'asset_type'
);

SET @assets_has_idx_asset_type := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets'
    AND INDEX_NAME = 'idx_assets_asset_type'
);

SET @sql_drop_assets_asset_type_index := IF(
  @assets_has_idx_asset_type > 0,
  'ALTER TABLE assets DROP INDEX idx_assets_asset_type',
  'SELECT 1'
);
PREPARE stmt_drop_assets_asset_type_index FROM @sql_drop_assets_asset_type_index;
EXECUTE stmt_drop_assets_asset_type_index;
DEALLOCATE PREPARE stmt_drop_assets_asset_type_index;

SET @sql_drop_assets_asset_type_column := IF(
  @assets_has_asset_type > 0,
  'ALTER TABLE assets DROP COLUMN asset_type',
  'SELECT 1'
);
PREPARE stmt_drop_assets_asset_type_column FROM @sql_drop_assets_asset_type_column;
EXECUTE stmt_drop_assets_asset_type_column;
DEALLOCATE PREPARE stmt_drop_assets_asset_type_column;

