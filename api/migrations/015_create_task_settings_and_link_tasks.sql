CREATE TABLE IF NOT EXISTS task_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_type ENUM('status', 'support_type') NOT NULL,
  setting_value VARCHAR(150) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_task_settings_type_value (setting_type, setting_value),
  KEY idx_task_settings_type_active (setting_type, is_active)
);

INSERT INTO task_settings (setting_type, setting_value, is_active, sort_order)
VALUES
  ('status', 'Baru', 1, 1),
  ('status', 'Tawaran Dihantar', 1, 2),
  ('status', 'Telah Diambil', 1, 3),
  ('status', 'Selesai', 1, 4),
  ('status', 'Borang Disemak & Pembayaran Tertunggak', 1, 5),
  ('status', 'Telah Dibayar', 1, 6),
  ('status', 'Dibatalkan', 1, 7),
  ('status', 'Selesai Penuh', 1, 8),
  ('support_type', 'Rangkaian (LAN/WAN)', 1, 1),
  ('support_type', 'Perkakasan Komputer', 1, 2),
  ('support_type', 'Perisian (OS Windows/Linux)', 1, 3),
  ('support_type', 'Sistem CCTV', 1, 4),
  ('support_type', 'Sistem POS', 1, 5),
  ('support_type', 'Pendawaian', 1, 6);

INSERT INTO task_settings (setting_type, setting_value, is_active, sort_order)
SELECT 'status', t.status, 1, 100
FROM tasks t
LEFT JOIN task_settings ts
  ON ts.setting_type = 'status' AND ts.setting_value = t.status
WHERE t.status IS NOT NULL AND ts.id IS NULL
GROUP BY t.status;

INSERT INTO task_settings (setting_type, setting_value, is_active, sort_order)
SELECT 'support_type', t.support_type, 1, 100
FROM tasks t
LEFT JOIN task_settings ts
  ON ts.setting_type = 'support_type' AND ts.setting_value = t.support_type
WHERE t.support_type IS NOT NULL AND ts.id IS NULL
GROUP BY t.support_type;

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

UPDATE tasks t
JOIN task_settings ts ON ts.setting_type = 'status' AND ts.setting_value = t.status
SET t.status_setting_id = ts.id
WHERE t.status IS NOT NULL;

UPDATE tasks t
JOIN task_settings ts ON ts.setting_type = 'support_type' AND ts.setting_value = t.support_type
SET t.support_type_setting_id = ts.id
WHERE t.support_type IS NOT NULL;

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
  'ALTER TABLE tasks ADD CONSTRAINT fk_tasks_status_setting_id FOREIGN KEY (status_setting_id) REFERENCES task_settings(id) ON UPDATE CASCADE ON DELETE SET NULL',
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
  'ALTER TABLE tasks ADD CONSTRAINT fk_tasks_support_type_setting_id FOREIGN KEY (support_type_setting_id) REFERENCES task_settings(id) ON UPDATE CASCADE ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;