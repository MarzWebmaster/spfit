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
    // Check current status and enum definition
    const [columns] = await connection.execute("SHOW COLUMNS FROM users WHERE Field = 'status'");
    console.log('Status column definition:', columns[0].Type);

    // Update the user to 'Aktif' if that's what's supported, otherwise 'active'
    let targetStatus = 'active';
    if (columns[0].Type.includes('Aktif')) {
      targetStatus = 'Aktif';
    }

    console.log(`Setting user status to: ${targetStatus}`);
    await connection.execute('UPDATE users SET status = ? WHERE email = ?', [targetStatus, 'admin@marz.my']);
    console.log('✅ User account activated successfully!');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}
fix();
