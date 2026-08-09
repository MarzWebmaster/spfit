-- Add bank fields to user_profiles and recipient fields to payments (idempotent)

SET @tbl_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'user_profiles'
);

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'user_profiles'
    AND column_name = 'bank_name'
);
SET @sql := IF(
  @tbl_exists > 0 AND @col_exists = 0,
  'ALTER TABLE user_profiles ADD COLUMN bank_name VARCHAR(120) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'user_profiles'
    AND column_name = 'bank_account_number'
);
SET @sql := IF(
  @tbl_exists > 0 AND @col_exists = 0,
  'ALTER TABLE user_profiles ADD COLUMN bank_account_number VARCHAR(50) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'user_profiles'
    AND column_name = 'payment_email'
);
SET @sql := IF(
  @tbl_exists > 0 AND @col_exists = 0,
  'ALTER TABLE user_profiles ADD COLUMN payment_email VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tbl_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
);

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
    AND column_name = 'recipient_name'
);
SET @sql := IF(
  @tbl_exists > 0 AND @col_exists = 0,
  'ALTER TABLE payments ADD COLUMN recipient_name VARCHAR(120) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
    AND column_name = 'recipient_account_number'
);
SET @sql := IF(
  @tbl_exists > 0 AND @col_exists = 0,
  'ALTER TABLE payments ADD COLUMN recipient_account_number VARCHAR(50) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
    AND column_name = 'recipient_bank_name'
);
SET @sql := IF(
  @tbl_exists > 0 AND @col_exists = 0,
  'ALTER TABLE payments ADD COLUMN recipient_bank_name VARCHAR(120) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
    AND column_name = 'recipient_email'
);
SET @sql := IF(
  @tbl_exists > 0 AND @col_exists = 0,
  'ALTER TABLE payments ADD COLUMN recipient_email VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
