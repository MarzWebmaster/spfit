import { AppDataSource } from '../config/database';
import { User, UserStatus } from '../models/User';

async function fixUserStatus() {
  try {
    console.log('Connecting to database...');
    await AppDataSource.initialize();
    console.log('Database connected successfully');

    const userRepository = AppDataSource.getRepository(User);

    // Get all users
    const users = await userRepository.find();
    console.log('Found users:', users.map(u => ({ id: u.id, email: u.email, status: u.status })));

    // Update all users to have 'active' status using query builder
    const result = await userRepository
      .createQueryBuilder()
      .update(User)
      .set({ status: UserStatus.AKTIF })
      .execute();
    
    console.log('Update result:', result);

    // Verify the update
    const updatedUsers = await userRepository.find();
    console.log('Updated users:', updatedUsers.map(u => ({ id: u.id, email: u.email, status: u.status })));

    await AppDataSource.destroy();
    console.log('Database connection closed');
    
  } catch (error) {
    console.error('Error fixing user status:', error);
    process.exit(1);
  }
}

fixUserStatus();