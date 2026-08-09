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
      'ALTER TABLE users ADD COLUMN profile_image VARCHAR(500) NULL',
      'ALTER TABLE users ADD COLUMN ban_reason TEXT NULL',
      'ALTER TABLE roles ADD COLUMN role_type_id INT NULL'
    ];

    for (const sql of columns) {
      try {
        await connection.execute(sql);
        console.log('✅ Executed successfully:', sql);
      } catch (e) {
        // Error 1060 is "Duplicate column name", which is safe to ignore
        if (e.errno === 1060) {
          console.log('ℹ️ Column already exists, skipping:', sql);
        } else {
          console.log('❌ Error executing:', sql, e.message);
        }
      }
    }
  } finally {
    await connection.end();
  }
}
fix();
