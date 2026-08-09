-- Add project relation to tasks (idempotent)

SET @tbl_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
);

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND column_name = 'project_id'
);

SET @sql := IF(
  @tbl_exists > 0 AND @col_exists = 0,
  'ALTER TABLE tasks ADD COLUMN project_id INT NULL AFTER main_con_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND index_name = 'idx_tasks_project_id'
);

SET @sql := IF(
  @tbl_exists > 0 AND @idx_exists = 0,
  'ALTER TABLE tasks ADD INDEX idx_tasks_project_id (project_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'tasks'
    AND constraint_name = 'fk_tasks_project_id_projects'
);

SET @sql := IF(
  @tbl_exists > 0 AND @fk_exists = 0,
  'ALTER TABLE tasks ADD CONSTRAINT fk_tasks_project_id_projects FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
