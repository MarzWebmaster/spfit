CREATE TABLE IF NOT EXISTS api_keys (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT 'Nama deskriptif untuk kunci API',
  key_hash VARCHAR(64) NOT NULL COMMENT 'SHA-256 hash of the API key',
  key_prefix VARCHAR(12) NOT NULL COMMENT 'First 12 chars for display identification',
  status ENUM('active', 'revoked') NOT NULL DEFAULT 'active',
  created_by INT NULL,
  last_used_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_api_keys_hash (key_hash),
  KEY idx_api_keys_status (status),
  KEY idx_api_keys_created_by (created_by),
  CONSTRAINT fk_api_keys_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
