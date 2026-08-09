import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function fix() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    const columns = [
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image VARCHAR(500) NULL',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT NULL',
      'ALTER TABLE roles ADD COLUMN IF NOT EXISTS role_type_id INT NULL'
    ];

    for (const sql of columns) {
      try {
        await connection.execute(sql);
        console.log('Executed:', sql);
      } catch (e) {
        console.log('Skipped/Error:', sql, e.message);
      }
    }
  } finally {
    await connection.end();
  }
}
fix();
