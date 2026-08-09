import { AppDataSource } from '../config/database';

async function checkTableStructure() {
  try {
    console.log('Connecting to database...');
    await AppDataSource.initialize();
    
    console.log('Checking users table structure...');
    const tableInfo = await AppDataSource.query('DESCRIBE users');
    console.log('Users table structure:', tableInfo);
    
    console.log('\nChecking current user data...');
    const users = await AppDataSource.query('SELECT * FROM users');
    console.log('Current users data:', users);
    
    await AppDataSource.destroy();
    console.log('Database connection closed');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTableStructure();