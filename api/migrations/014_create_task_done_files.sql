CREATE TABLE IF NOT EXISTS task_done_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_done_id INT NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_task_done_files_task_done_id (task_done_id),
  INDEX idx_task_done_files_created_at (created_at),
  CONSTRAINT fk_task_done_files_task_done FOREIGN KEY (task_done_id) REFERENCES task_done(id) ON DELETE CASCADE
);
