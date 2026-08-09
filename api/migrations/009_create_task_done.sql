-- Create table for completed tasks submissions
CREATE TABLE IF NOT EXISTS task_done (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  freelancer_id INT NOT NULL,
  service_start_date DATE,
  action_taken TEXT,
  remarks TEXT,
  support_pdf_url VARCHAR(500),
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (freelancer_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_task_done_task_id (task_id),
  INDEX idx_task_done_freelancer_id (freelancer_id),
  INDEX idx_task_done_submitted_at (submitted_at)
);
