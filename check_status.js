import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    const [rows] = await connection.execute('SELECT email, status FROM users WHERE email = ?', ['admin@marz.my']);
    console.log('User Data in DB:', rows[0]);
  } finally {
    await connection.end();
  }
}
check();
