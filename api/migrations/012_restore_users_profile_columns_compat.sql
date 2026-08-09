ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL;
ALTER TABLE users ADD COLUMN ic_number VARCHAR(20) NULL;
ALTER TABLE users ADD COLUMN experience INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN rating DECIMAL(3,2) NOT NULL DEFAULT 0.00;
ALTER TABLE users ADD COLUMN is_available BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE users u
LEFT JOIN user_profiles up ON up.user_id = u.id
SET
  u.phone = COALESCE(u.phone, up.phone),
  u.ic_number = COALESCE(u.ic_number, up.ic_number),
  u.experience = COALESCE(u.experience, up.experience, 0),
  u.rating = COALESCE(u.rating, up.rating, 0.00),
  u.is_available = COALESCE(u.is_available, up.is_available, TRUE)
WHERE up.user_id IS NOT NULL;