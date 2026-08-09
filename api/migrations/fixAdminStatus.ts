import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function fixAdminStatus() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'spfit_db',
    port: parseInt(process.env.DB_PORT || '3306')
  });

  try {
    console.log('Connecting to database...');
    
    // Update admin user status
    const [result] = await connection.execute(
      "UPDATE `users` SET `status` = 'Aktif' WHERE `email` = 'admin@spfit.com'"
    );
    
    console.log('Admin user status updated successfully:', result);
    
    // Verify the update
    const [rows] = await connection.execute(
      "SELECT id, name, email, status FROM `users` WHERE `email` = 'admin@spfit.com'"
    );
    
    console.log('Updated admin user:', rows);
    
  } catch (error) {
    console.error('Error updating admin status:', error);
  } finally {
    await connection.end();
  }
}

fixAdminStatus();