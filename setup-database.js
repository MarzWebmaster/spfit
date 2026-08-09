import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

async function setupDatabase() {
  console.log('🚀 Setting up SPFIT database...');
  
  const rootConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: 'root',
    password: '', // Assuming no root password
    multipleStatements: true
  };
  
  const dbName = process.env.DB_NAME || 'spfit_db';
  const dbUser = process.env.DB_USER || 'spfit_user';
  const dbPassword = process.env.DB_PASSWORD || 'spfit123';
  
  try {
    // Connect as root
    const connection = await mysql.createConnection(rootConfig);
    console.log('✅ Connected to MySQL as root');
    
    // Create database
    console.log(`🗄️ Creating database: ${dbName}`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log('✅ Database created successfully');
    
    // Create user
    console.log(`👤 Creating user: ${dbUser}`);
    await connection.query(`CREATE USER IF NOT EXISTS '${dbUser}'@'localhost' IDENTIFIED BY '${dbPassword}'`);
    console.log('✅ User created successfully');
    
    // Grant privileges
    console.log(`🔐 Granting privileges to ${dbUser}`);
    await connection.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'localhost'`);
    await connection.query('FLUSH PRIVILEGES');
    console.log('✅ Privileges granted successfully');
    
    // Run migration if exists
    const migrationPath = path.join(process.cwd(), 'api', 'migrations', '001_initial_schema.sql');
    if (fs.existsSync(migrationPath)) {
      console.log('📋 Running initial migration...');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      // Switch to the database
      await connection.query(`USE \`${dbName}\``);
      
      // Execute the entire migration SQL at once
      try {
        await connection.query(migrationSQL);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.warn('⚠️ Migration warning:', error.message);
        }
      }
      
      console.log('✅ Migration completed successfully');
    } else {
      console.log('⚠️ No migration file found at:', migrationPath);
    }
    
    await connection.end();
    console.log('🎉 Database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  }
}

setupDatabase();