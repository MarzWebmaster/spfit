import { AppDataSource } from '../config/database';

async function checkDatabase() {
  try {
    console.log('Connecting to database...');
    await AppDataSource.initialize();
    
    console.log('Checking users table...');
    const users = await AppDataSource.query('SELECT id, email, status, role_id FROM users');
    console.log('Users found:', users);
    
    console.log('Checking roles table...');
    const roles = await AppDataSource.query('SELECT * FROM roles');
    console.log('Roles found:', roles);
    
    await AppDataSource.destroy();
    console.log('Database connection closed');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDatabase();