CREATE TABLE IF NOT EXISTS task_statuses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_task_statuses_name (name),
  KEY idx_task_statuses_active (is_active)
);

CREATE TABLE IF NOT EXISTS support_type_options (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_support_type_options_name (name),
  KEY idx_support_type_options_active (is_active)
);

CREATE TABLE IF NOT EXISTS equipment_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_equipment_codes_code (code),
  KEY idx_equipment_codes_active (is_active)
);

INSERT IGNORE INTO task_statuses (name, is_active, sort_order)
VALUES
  ('Baru', 1, 1),
  ('Tawaran Dihantar', 1, 2),
  ('Telah Diambil', 1, 3),
  ('Selesai', 1, 4),
  ('Borang Disemak & Pembayaran Tertunggak', 1, 5),
  ('Telah Dibayar', 1, 6),
  ('Dibatalkan', 1, 7),
  ('Selesai Penuh', 1, 8);

INSERT IGNORE INTO support_type_options (name, is_active, sort_order)
VALUES
  ('Rangkaian (LAN/WAN)', 1, 1),
  ('Perkakasan Komputer', 1, 2),
  ('Perisian (OS Windows/Linux)', 1, 3),
  ('Sistem CCTV', 1, 4),
  ('Sistem POS', 1, 5),
  ('Pendawaian', 1, 6);

INSERT IGNORE INTO equipment_codes (code, is_active, sort_order)
VALUES
  ('PC', 1, 1),
  ('NOTEBOOK', 1, 2),
  ('PRINTER', 1, 3),
  ('PROJECTOR', 1, 4),
  ('MONITOR', 1, 5);

-- Ensure backward compatibility when older databases never had task_settings
CREATE TABLE IF NOT EXISTS task_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_type VARCHAR(100) NULL,
  setting_value VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

SET @task_settings_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'task_settings'
);

SET @sql := IF(
  @task_settings_exists > 0,
  'INSERT IGNORE INTO task_statuses (name, is_active, sort_order) SELECT setting_value, is_active, sort_order FROM task_settings WHERE setting_type = ''status''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  @task_settings_exists > 0,
  'INSERT IGNORE INTO support_type_options (name, is_active, sort_order) SELECT setting_value, is_active, sort_order FROM task_settings WHERE setting_type = ''support_type''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tasks_status_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND column_name = 'status'
);
SET @sql := IF(
  @tasks_status_col_exists > 0,
  'INSERT IGNORE INTO task_statuses (name, is_active, sort_order) SELECT DISTINCT t.status, 1, 100 FROM tasks t WHERE t.status IS NOT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tasks_support_type_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND column_name = 'support_type'
);
SET @sql := IF(
  @tasks_support_type_col_exists > 0,
  'INSERT IGNORE INTO support_type_options (name, is_active, sort_order) SELECT DISTINCT t.support_type, 1, 100 FROM tasks t WHERE t.support_type IS NOT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND column_name = 'status_setting_id'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE tasks ADD COLUMN status_setting_id INT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND column_name = 'support_type_setting_id'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE tasks ADD COLUMN support_type_setting_id INT NULL',
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
    AND index_name = 'idx_tasks_status_setting_id'
);
SET @sql := IF(
  @idx_exists = 0,
  'ALTER TABLE tasks ADD INDEX idx_tasks_status_setting_id (status_setting_id)',
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
    AND index_name = 'idx_tasks_support_type_setting_id'
);
SET @sql := IF(
  @idx_exists = 0,
  'ALTER TABLE tasks ADD INDEX idx_tasks_support_type_setting_id (support_type_setting_id)',
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
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name = 'fk_tasks_status_setting_id'
);
SET @sql := IF(
  @fk_exists > 0,
  'ALTER TABLE tasks DROP FOREIGN KEY fk_tasks_status_setting_id',
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
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name = 'fk_tasks_support_type_setting_id'
);
SET @sql := IF(
  @fk_exists > 0,
  'ALTER TABLE tasks DROP FOREIGN KEY fk_tasks_support_type_setting_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tasks_status_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND column_name = 'status'
);
SET @sql := IF(
  @tasks_status_col_exists > 0,
  'UPDATE tasks t JOIN task_statuses ts ON ts.name = t.status SET t.status_setting_id = ts.id WHERE t.status IS NOT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tasks_support_type_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tasks'
    AND column_name = 'support_type'
);
SET @sql := IF(
  @tasks_support_type_col_exists > 0,
  'UPDATE tasks t JOIN support_type_options st ON st.name = t.support_type SET t.support_type_setting_id = st.id WHERE t.support_type IS NOT NULL',
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
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name = 'fk_tasks_status_setting_id'
);
SET @sql := IF(
  @fk_exists = 0,
  'ALTER TABLE tasks ADD CONSTRAINT fk_tasks_status_setting_id FOREIGN KEY (status_setting_id) REFERENCES task_statuses(id) ON UPDATE CASCADE ON DELETE SET NULL',
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
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name = 'fk_tasks_support_type_setting_id'
);
SET @sql := IF(
  @fk_exists = 0,
  'ALTER TABLE tasks ADD CONSTRAINT fk_tasks_support_type_setting_id FOREIGN KEY (support_type_setting_id) REFERENCES support_type_options(id) ON UPDATE CASCADE ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @task_settings_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'task_settings'
);
SET @sql := IF(@task_settings_exists > 0, 'DROP TABLE task_settings', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;