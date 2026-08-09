import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function fixAdminPassword() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    // Check current password hash
    const [rows] = await connection.execute(
      'SELECT id, name, email, password_hash FROM users WHERE email = ?',
      ['admin@spfit.com']
    );
    
    console.log('Current admin user data:', rows[0]);
    
    // Update with correct hash from migration file
    const correctHash = '$2a$12$tHavYAXwJXWy6mL0RQh6x.bDaRI0eTe2C2GUlbHsh60jC4tF3/b3i';
    
    const [result] = await connection.execute(
      'UPDATE users SET password_hash = ? WHERE email = ?',
      [correctHash, 'admin@spfit.com']
    );
    
    console.log('Update result:', result);
    
    // Verify the update
    const [updatedRows] = await connection.execute(
      'SELECT id, name, email, password_hash FROM users WHERE email = ?',
      ['admin@spfit.com']
    );
    
    console.log('Updated admin user data:', updatedRows[0]);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

fixAdminPassword();