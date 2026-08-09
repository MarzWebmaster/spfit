-- Create projects table (idempotent)

CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  client_name VARCHAR(255) NULL,
  description TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Aktif',
  start_date DATE NULL,
  end_date DATE NULL,
  budget DECIMAL(12,2) NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_projects_code (code),
  INDEX idx_projects_name (name),
  INDEX idx_projects_status (status),
  INDEX idx_projects_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'projects'
    AND constraint_name = 'fk_projects_created_by_users'
);

SET @sql := IF(
  @fk_exists = 0,
  'ALTER TABLE projects ADD CONSTRAINT fk_projects_created_by_users FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
