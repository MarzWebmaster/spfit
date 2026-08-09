-- Add payment reference and slip columns (idempotent)

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
    AND column_name = 'payment_reference'
);
SET @sql := IF(
  @tbl_exists > 0 AND @col_exists = 0,
  'ALTER TABLE payments ADD COLUMN payment_reference VARCHAR(120) NULL',
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
    AND column_name = 'payment_slip_url'
);
SET @sql := IF(
  @tbl_exists > 0 AND @col_exists = 0,
  'ALTER TABLE payments ADD COLUMN payment_slip_url VARCHAR(500) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
