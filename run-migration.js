import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runMigration() {
  let connection;
  
  try {
    console.log('🔄 Connecting to MySQL database...');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spfit_db'
    });
    
    console.log('✅ Connected to database successfully');
    
    // Execute CREATE TABLE statement
    console.log('📝 Creating user_sessions table...');
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS \`user_sessions\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`user_id\` int NOT NULL,
        \`token_hash\` varchar(500) NOT NULL UNIQUE,
        \`ip_address\` varchar(45),
        \`user_agent\` text,
        \`expires_at\` timestamp NOT NULL,
        \`is_active\` boolean DEFAULT true,
        \`last_activity\` timestamp NULL,
        \`created_at\` timestamp DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
        INDEX \`idx_user_sessions_user_id\` (\`user_id\`),
        INDEX \`idx_user_sessions_token_hash\` (\`token_hash\`),
        INDEX \`idx_user_sessions_is_active\` (\`is_active\`),
        INDEX \`idx_user_sessions_expires_at\` (\`expires_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    try {
      await connection.execute(createTableSQL);
      console.log('✅ user_sessions table created successfully');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️  user_sessions table already exists');
      } else {
        console.error('❌ Error creating table:', error.message);
        throw error;
      }
    }
    
    // Clean up expired sessions
    console.log('🧹 Cleaning up expired sessions...');
    try {
      const cleanupSQL = "DELETE FROM \`user_sessions\` WHERE \`expires_at\` < NOW() OR \`is_active\` = false";
      const [result] = await connection.execute(cleanupSQL);
      console.log(`✅ Cleaned up ${result.affectedRows} expired sessions`);
    } catch (error) {
      console.log('⚠️  Cleanup skipped (table might be empty):', error.message);
    }
    
    console.log('🎉 Migration completed successfully!');
    
    // Verify table creation
    console.log('🔍 Verifying user_sessions table...');
    const [tables] = await connection.execute("SHOW TABLES LIKE 'user_sessions'");
    
    if (tables.length > 0) {
      console.log('✅ user_sessions table verified');
      
      // Show table structure
      const [columns] = await connection.execute('DESCRIBE user_sessions');
      console.log('📋 Table structure:');
      console.table(columns);
    } else {
      console.log('❌ user_sessions table not found');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run migration
runMigration();