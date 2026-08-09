import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function updateUserStatusEnum() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'spfit_db',
    port: parseInt(process.env.DB_PORT || '3306')
  });

  try {
    console.log('Connecting to database...');
    
    // First, alter the column to include both old and new enum values
    console.log('Adding new enum values to column...');
    await connection.execute(
      "ALTER TABLE `users` MODIFY COLUMN `status` ENUM('active', 'inactive', 'banned', 'Aktif', 'Tidak Aktif', 'Disekat') NOT NULL DEFAULT 'active'"
    );
    
    // Then update existing values to new enum values
    console.log('Updating existing status values...');
    await connection.execute(
      "UPDATE `users` SET `status` = 'Aktif' WHERE `status` = 'active'"
    );
    await connection.execute(
      "UPDATE `users` SET `status` = 'Tidak Aktif' WHERE `status` = 'inactive'"
    );
    await connection.execute(
      "UPDATE `users` SET `status` = 'Disekat' WHERE `status` = 'banned'"
    );
    
    // Finally, remove the old enum values
    console.log('Removing old enum values...');
    await connection.execute(
      "ALTER TABLE `users` MODIFY COLUMN `status` ENUM('Aktif', 'Tidak Aktif', 'Disekat') NOT NULL DEFAULT 'Aktif'"
    );
    
    console.log('Status enum updated successfully!');
    
    // Verify the update
    const [columns] = await connection.execute(
      "SHOW COLUMNS FROM `users` WHERE Field = 'status'"
    );
    
    console.log('Updated status column definition:', columns);
    
    // Check current admin user
    const [rows] = await connection.execute(
      "SELECT id, name, email, status FROM `users` WHERE `email` = 'admin@spfit.com'"
    );
    
    console.log('Updated admin user:', rows);
    
  } catch (error) {
    console.error('Error updating status enum:', error);
  } finally {
    await connection.end();
  }
}

updateUserStatusEnum();