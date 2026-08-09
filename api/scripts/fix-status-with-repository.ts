import { AppDataSource } from '../config/database';
import { User, UserStatus } from '../models/User';

async function fixStatusWithRepository() {
  try {
    console.log('Connecting to database...');
    await AppDataSource.initialize();
    
    const userRepository = AppDataSource.getRepository(User);
    
    console.log('Getting all users...');
    const users = await userRepository.find();
    console.log('Found users:', users.map(u => ({ id: u.id, email: u.email, status: u.status })));
    
    console.log('Updating user status using repository...');
    for (const user of users) {
      user.status = UserStatus.AKTIF;
      await userRepository.save(user);
      console.log(`Updated user ${user.email} to status: ${user.status}`);
    }
    
    console.log('Verifying updates...');
    const updatedUsers = await userRepository.find();
    console.log('Updated users:', updatedUsers.map(u => ({ id: u.id, email: u.email, status: u.status })));
    
    await AppDataSource.destroy();
    console.log('Database connection closed');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixStatusWithRepository();