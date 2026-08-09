-- Create main_cons table
CREATE TABLE IF NOT EXISTS main_cons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  contact_number VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create task_parts table for hardware replacements
CREATE TABLE IF NOT EXISTS task_parts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  part_number VARCHAR(100),
  description VARCHAR(255),
  quantity INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Alter tasks table to add new fields
ALTER TABLE tasks
ADD COLUMN main_con_id INT,
ADD COLUMN pic_name VARCHAR(255),
ADD COLUMN pic_phone VARCHAR(50),
ADD COLUMN client_name VARCHAR(255),
ADD COLUMN asset_tag_id VARCHAR(100),
ADD COLUMN asset_brand VARCHAR(100),
ADD COLUMN asset_model VARCHAR(100),
ADD COLUMN asset_serial_number VARCHAR(100),
ADD COLUMN branch_name VARCHAR(255),
ADD COLUMN equipment_types JSON COMMENT 'Array of selected equipment: ["PC", "NOTEBOOK", "PRINTER", "PROJECTOR"]',
ADD COLUMN received_date DATE,
ADD COLUMN received_time TIME,
ADD COLUMN irt_date DATE,
ADD COLUMN irt_time TIME,
ADD COLUMN service_start_date DATE,
ADD COLUMN service_start_time TIME,
ADD COLUMN service_stop_date DATE,
ADD COLUMN service_stop_time TIME,
ADD COLUMN action_taken TEXT,
ADD CONSTRAINT fk_tasks_main_con FOREIGN KEY (main_con_id) REFERENCES main_cons(id);

-- Add index for main_con_id
CREATE INDEX idx_tasks_main_con_id ON tasks(main_con_id);
