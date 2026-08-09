import { AppDataSource } from '../config/database';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runUserSessionsMigration() {
  try {
    console.log('Initializing database connection...');
    await AppDataSource.initialize();
    console.log('Database connected successfully');

    console.log('Running user_sessions migration...');
    
    // Create user_sessions table directly
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
    
    console.log('Creating user_sessions table...');
    await AppDataSource.query(createTableSQL);
    
    console.log('Cleaning up expired sessions...');
    await AppDataSource.query('DELETE FROM `user_sessions` WHERE `expires_at` < NOW() OR `is_active` = false');
    
    console.log('Migration completed successfully!');
    
    // Verify table creation
    const tables = await AppDataSource.query('SHOW TABLES LIKE "user_sessions"');
    if (tables.length > 0) {
      console.log('✅ user_sessions table created successfully');
      
      // Show table structure
      const structure = await AppDataSource.query('DESCRIBE user_sessions');
      console.log('Table structure:');
      console.table(structure);
    } else {
      console.log('❌ user_sessions table was not created');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('Database connection closed');
    }
  }
}

runUserSessionsMigration();