-- Add optional main_con relation to projects (idempotent)

SET @tbl_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'projects'
);

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'projects'
    AND column_name = 'main_con_id'
);

SET @sql := IF(
  @tbl_exists > 0 AND @col_exists = 0,
  'ALTER TABLE projects ADD COLUMN main_con_id INT NULL AFTER budget',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'projects'
    AND index_name = 'idx_projects_main_con_id'
);

SET @sql := IF(
  @tbl_exists > 0 AND @idx_exists = 0,
  'ALTER TABLE projects ADD INDEX idx_projects_main_con_id (main_con_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'projects'
    AND constraint_name = 'fk_projects_main_con_id_main_cons'
);

SET @sql := IF(
  @tbl_exists > 0 AND @fk_exists = 0,
  'ALTER TABLE projects ADD CONSTRAINT fk_projects_main_con_id_main_cons FOREIGN KEY (main_con_id) REFERENCES main_cons(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
