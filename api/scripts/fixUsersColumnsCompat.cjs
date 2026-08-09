const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const statements = [
    'ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL',
    'ALTER TABLE users ADD COLUMN ic_number VARCHAR(20) NULL',
    'ALTER TABLE users ADD COLUMN experience INT NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN rating DECIMAL(3,2) NOT NULL DEFAULT 0.00',
    'ALTER TABLE users ADD COLUMN is_available BOOLEAN NOT NULL DEFAULT TRUE',
    "UPDATE users u LEFT JOIN user_profiles up ON up.user_id = u.id SET u.phone = COALESCE(u.phone, up.phone), u.ic_number = COALESCE(u.ic_number, up.ic_number), u.experience = COALESCE(u.experience, up.experience, 0), u.rating = COALESCE(u.rating, up.rating, 0.00), u.is_available = COALESCE(u.is_available, up.is_available, TRUE) WHERE up.user_id IS NOT NULL"
  ];

  for (const sql of statements) {
    try {
      await conn.query(sql);
      console.log('OK:', sql);
    } catch (error) {
      if (error && error.errno === 1060) {
        console.log('SKIP duplicate:', sql);
      } else {
        throw error;
      }
    }
  }

  const [rows] = await conn.query("SHOW COLUMNS FROM users WHERE Field IN ('phone','ic_number','experience','rating','is_available')");
  console.log(rows);

  await conn.end();
})().catch((error) => {
  console.error('Failed:', error);
  process.exit(1);
});