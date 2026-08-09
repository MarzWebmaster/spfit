import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function checkUserSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'spfit_db',
    port: parseInt(process.env.DB_PORT || '3306')
  });

  try {
    console.log('Connecting to database...');
    
    // Check the users table schema
    const [columns] = await connection.execute(
      "SHOW COLUMNS FROM `users` WHERE Field = 'status'"
    );
    
    console.log('Status column definition:', columns);
    
    // Check current admin user
    const [rows] = await connection.execute(
      "SELECT id, name, email, status FROM `users` WHERE `email` = 'admin@spfit.com'"
    );
    
    console.log('Current admin user:', rows);
    
  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    await connection.end();
  }
}

checkUserSchema();