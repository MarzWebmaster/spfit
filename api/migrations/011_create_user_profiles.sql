CREATE TABLE IF NOT EXISTS user_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  phone VARCHAR(20) NULL,
  ic_number VARCHAR(20) NULL,
  experience INT NOT NULL DEFAULT 0,
  rating DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_profiles_user_id (user_id),
  CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO user_profiles (user_id, phone, ic_number, experience, rating, is_available, created_at, updated_at)
SELECT
  u.id,
  u.phone,
  u.ic_number,
  COALESCE(u.experience, 0),
  COALESCE(u.rating, 0.00),
  COALESCE(u.is_available, TRUE),
  COALESCE(u.created_at, NOW()),
  COALESCE(u.updated_at, NOW())
FROM users u
LEFT JOIN user_profiles up ON up.user_id = u.id
WHERE up.user_id IS NULL;