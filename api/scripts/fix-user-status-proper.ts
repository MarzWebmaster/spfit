import { AppDataSource } from '../config/database';
import { User, UserStatus } from '../models/User';

async function fixUserStatusProperly() {
  try {
    console.log('Connecting to database...');
    await AppDataSource.initialize();
    
    console.log('Setting proper status for all users...');
    
    // Update all users to have 'Aktif' status
    const result1 = await AppDataSource.query(
      "UPDATE users SET status = 'Aktif' WHERE id = 1"
    );
    console.log('Updated admin@spfit.com:', result1);
    
    const result2 = await AppDataSource.query(
      "UPDATE users SET status = 'Aktif' WHERE id = 2"
    );
    console.log('Updated admin@marz.my:', result2);
    
    console.log('Checking updated users...');
    const users = await AppDataSource.query('SELECT id, email, status, role_id FROM users');
    console.log('Users after update:', users);
    
    await AppDataSource.destroy();
    console.log('Database connection closed');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixUserStatusProperly();