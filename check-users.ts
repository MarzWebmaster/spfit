import { AppDataSource } from './api/config/database';
import { User } from './api/models/User';
import { Role } from './api/models/Role';

async function checkUsers() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected successfully');
    
    const userRepo = AppDataSource.getRepository(User);
    const users = await userRepo.find({ 
      relations: ['role'],
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        role: {
          id: true,
          name: true
        }
      }
    });
    
    console.log('\nUsers with roles:');
    console.log('==================');
    users.forEach(user => {
      console.log(`ID: ${user.id}`);
      console.log(`Name: ${user.name}`);
      console.log(`Email: ${user.email}`);
      console.log(`Role: ${user.role?.name || 'No role'}`);
      console.log(`Status: ${user.status}`);
      console.log('---');
    });
    
    await AppDataSource.destroy();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkUsers();