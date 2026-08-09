import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function addProfileImageColumn() {
  let connection;
  
  try {
    console.log('Connecting to MySQL database...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spfit_db'
    });
    
    console.log('Connected successfully!');
    
    // Add profile_image column
    console.log('Adding profile_image column to users table...');
    await connection.execute(`
      ALTER TABLE users 
      ADD COLUMN profile_image VARCHAR(255) NULL
    `);
    
    console.log('✅ profile_image column added successfully!');
    
    // Verify the column was added
    console.log('\nVerifying column was added...');
    const [columns] = await connection.execute('DESCRIBE users');
    const profileImageColumn = (columns as any[]).find(col => col.Field === 'profile_image');
    
    if (profileImageColumn) {
      console.log('✅ Verification successful: profile_image column exists');
      console.log('Column details:', profileImageColumn);
    } else {
      console.log('❌ Verification failed: profile_image column not found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addProfileImageColumn();