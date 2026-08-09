import { AppDataSource } from '../config/database';

async function setUserStatusAktif() {
  try {
    console.log('Connecting to database...');
    await AppDataSource.initialize();
    
    console.log('Setting status to Aktif for all users...');
    
    // Use direct SQL to update status
    const result = await AppDataSource.query(
      "UPDATE users SET status = ? WHERE id IN (1, 2)",
      ['Aktif']
    );
    
    console.log('Update result:', result);
    
    console.log('Verifying updated users...');
    const users = await AppDataSource.query('SELECT id, email, status, role_id FROM users');
    console.log('Users after update:', users);
    
    await AppDataSource.destroy();
    console.log('Database connection closed');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

setUserStatusAktif();