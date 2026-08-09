import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function createAdmin() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    const email = 'admin@marz.my';
    const password = 'admin123';
    
    console.log(`Hashing password for ${email}...`);
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Check if user exists
    const [existingUsers] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      console.log(`User ${email} exists, updating password and role...`);
      await connection.execute(
        'UPDATE users SET password_hash = ?, role_id = 1, status = "active" WHERE email = ?',
        [passwordHash, email]
      );
      console.log('User updated successfully.');
    } else {
      console.log(`Creating new user ${email}...`);
      await connection.execute(
        'INSERT INTO users (name, email, password_hash, role_id, status) VALUES (?, ?, ?, ?, ?)',
        ['Admin Marz', email, passwordHash, 1, 'active']
      );
      console.log('User created successfully.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

createAdmin();
