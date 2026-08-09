import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function checkUsersInDatabase() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spfit_db'
    });
    
    console.log('✅ Connected to database successfully');
    
    // Check if users table exists
    console.log('\n🔍 Checking if users table exists...');
    const [tables] = await connection.execute('SHOW TABLES LIKE "users"');
    
    if (tables.length === 0) {
      console.log('❌ Users table does not exist!');
      return;
    }
    
    console.log('✅ Users table exists');
    
    // Get table structure
    console.log('\n📋 Users table structure:');
    const [columns] = await connection.execute('DESCRIBE users');
    console.table(columns);
    
    // Count total users
    console.log('\n📊 Counting total users...');
    const [countResult] = await connection.execute('SELECT COUNT(*) as total FROM users');
    console.log(`Total users in database: ${countResult[0].total}`);
    
    // Get recent users
    console.log('\n👥 Recent users (last 10):');
    const [users] = await connection.execute(`
      SELECT id, name, email, role_id, status, created_at, updated_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    if (users.length === 0) {
      console.log('❌ No users found in database!');
    } else {
      console.table(users);
    }
    
    // Check roles table
    console.log('\n🔍 Checking roles...');
    const [roles] = await connection.execute('SELECT id, name FROM roles');
    console.log('Available roles:');
    console.table(roles);
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    console.error('Full error:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

checkUsersInDatabase();