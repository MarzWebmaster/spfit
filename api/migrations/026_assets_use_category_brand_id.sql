-- Move assets category/brand from free text columns to FK ids
-- and backfill master data from existing values.

SET @assets_has_category_id := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets'
    AND COLUMN_NAME = 'category_id'
);
SET @sql_assets_add_category_id := IF(
  @assets_has_category_id = 0,
  'ALTER TABLE assets ADD COLUMN category_id INT NULL AFTER name',
  'SELECT 1'
);
PREPARE stmt_assets_add_category_id FROM @sql_assets_add_category_id;
EXECUTE stmt_assets_add_category_id;
DEALLOCATE PREPARE stmt_assets_add_category_id;

SET @assets_has_brand_id := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets'
    AND COLUMN_NAME = 'brand_id'
);
SET @sql_assets_add_brand_id := IF(
  @assets_has_brand_id = 0,
  'ALTER TABLE assets ADD COLUMN brand_id INT NULL AFTER category_id',
  'SELECT 1'
);
PREPARE stmt_assets_add_brand_id FROM @sql_assets_add_brand_id;
EXECUTE stmt_assets_add_brand_id;
DEALLOCATE PREPARE stmt_assets_add_brand_id;

SET @assets_has_legacy_category := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets'
    AND COLUMN_NAME = 'category'
);
SET @assets_has_legacy_brand := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets'
    AND COLUMN_NAME = 'brand'
);

SET @sql_seed_asset_category := IF(
  @assets_has_legacy_category = 1,
  'INSERT IGNORE INTO asset_category (name) SELECT DISTINCT TRIM(category) FROM assets WHERE category IS NOT NULL AND TRIM(category) <> ''''',
  'SELECT 1'
);
PREPARE stmt_seed_asset_category FROM @sql_seed_asset_category;
EXECUTE stmt_seed_asset_category;
DEALLOCATE PREPARE stmt_seed_asset_category;

SET @sql_seed_asset_brand := IF(
  @assets_has_legacy_brand = 1,
  'INSERT IGNORE INTO asset_brand (name) SELECT DISTINCT TRIM(brand) FROM assets WHERE brand IS NOT NULL AND TRIM(brand) <> ''''',
  'SELECT 1'
);
PREPARE stmt_seed_asset_brand FROM @sql_seed_asset_brand;
EXECUTE stmt_seed_asset_brand;
DEALLOCATE PREPARE stmt_seed_asset_brand;

SET @sql_backfill_category_id := IF(
  @assets_has_legacy_category = 1,
  'UPDATE assets a JOIN asset_category ac ON ac.name = TRIM(a.category) SET a.category_id = ac.id WHERE a.category_id IS NULL AND a.category IS NOT NULL AND TRIM(a.category) <> ''''',
  'SELECT 1'
);
PREPARE stmt_backfill_category_id FROM @sql_backfill_category_id;
EXECUTE stmt_backfill_category_id;
DEALLOCATE PREPARE stmt_backfill_category_id;

SET @sql_backfill_brand_id := IF(
  @assets_has_legacy_brand = 1,
  'UPDATE assets a JOIN asset_brand ab ON ab.name = TRIM(a.brand) SET a.brand_id = ab.id WHERE a.brand_id IS NULL AND a.brand IS NOT NULL AND TRIM(a.brand) <> ''''',
  'SELECT 1'
);
PREPARE stmt_backfill_brand_id FROM @sql_backfill_brand_id;
EXECUTE stmt_backfill_brand_id;
DEALLOCATE PREPARE stmt_backfill_brand_id;

SET @assets_has_category_id_index := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets'
    AND INDEX_NAME = 'idx_assets_category_id'
);
SET @sql_assets_category_id_index := IF(
  @assets_has_category_id_index = 0,
  'ALTER TABLE assets ADD INDEX idx_assets_category_id (category_id)',
  'SELECT 1'
);
PREPARE stmt_assets_category_id_index FROM @sql_assets_category_id_index;
EXECUTE stmt_assets_category_id_index;
DEALLOCATE PREPARE stmt_assets_category_id_index;

SET @assets_has_brand_id_index := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets'
    AND INDEX_NAME = 'idx_assets_brand_id'
);
SET @sql_assets_brand_id_index := IF(
  @assets_has_brand_id_index = 0,
  'ALTER TABLE assets ADD INDEX idx_assets_brand_id (brand_id)',
  'SELECT 1'
);
PREPARE stmt_assets_brand_id_index FROM @sql_assets_brand_id_index;
EXECUTE stmt_assets_brand_id_index;
DEALLOCATE PREPARE stmt_assets_brand_id_index;

SET @assets_has_fk_category := (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets'
    AND CONSTRAINT_NAME = 'fk_assets_category_id'
);
SET @sql_assets_fk_category := IF(
  @assets_has_fk_category = 0,
  'ALTER TABLE assets ADD CONSTRAINT fk_assets_category_id FOREIGN KEY (category_id) REFERENCES asset_category(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt_assets_fk_category FROM @sql_assets_fk_category;
EXECUTE stmt_assets_fk_category;
DEALLOCATE PREPARE stmt_assets_fk_category;

SET @assets_has_fk_brand := (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets'
    AND CONSTRAINT_NAME = 'fk_assets_brand_id'
);
SET @sql_assets_fk_brand := IF(
  @assets_has_fk_brand = 0,
  'ALTER TABLE assets ADD CONSTRAINT fk_assets_brand_id FOREIGN KEY (brand_id) REFERENCES asset_brand(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt_assets_fk_brand FROM @sql_assets_fk_brand;
EXECUTE stmt_assets_fk_brand;
DEALLOCATE PREPARE stmt_assets_fk_brand;

SET @sql_assets_drop_legacy_category := IF(
  @assets_has_legacy_category = 1,
  'ALTER TABLE assets DROP COLUMN category',
  'SELECT 1'
);
PREPARE stmt_assets_drop_legacy_category FROM @sql_assets_drop_legacy_category;
EXECUTE stmt_assets_drop_legacy_category;
DEALLOCATE PREPARE stmt_assets_drop_legacy_category;

SET @sql_assets_drop_legacy_brand := IF(
  @assets_has_legacy_brand = 1,
  'ALTER TABLE assets DROP COLUMN brand',
  'SELECT 1'
);
PREPARE stmt_assets_drop_legacy_brand FROM @sql_assets_drop_legacy_brand;
EXECUTE stmt_assets_drop_legacy_brand;
DEALLOCATE PREPARE stmt_assets_drop_legacy_brand;
