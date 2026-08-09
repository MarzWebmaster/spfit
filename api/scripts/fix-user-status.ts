import { AppDataSource } from '../config/database';
import { User, UserStatus } from '../models/User';

async function fixUserStatus() {
  try {
    console.log('Connecting to database...');
    await AppDataSource.initialize();
    
    console.log('Updating user status from "active" to "Aktif"...');
    const result = await AppDataSource.query(
      "UPDATE users SET status = 'Aktif' WHERE status = 'active'"
    );
    
    console.log('Update result:', result);
    
    console.log('Checking updated users...');
    const users = await AppDataSource.query('SELECT id, email, status FROM users');
    console.log('Users after update:', users);
    
    await AppDataSource.destroy();
    console.log('Database connection closed');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixUserStatus();