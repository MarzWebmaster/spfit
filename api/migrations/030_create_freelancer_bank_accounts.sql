CREATE TABLE IF NOT EXISTS freelancer_bank_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  bank_name VARCHAR(120) NOT NULL,
  account_holder_name VARCHAR(120) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_freelancer_bank_accounts_user_id (user_id),
  INDEX idx_freelancer_bank_accounts_user_default (user_id, is_default),
  CONSTRAINT fk_freelancer_bank_accounts_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
