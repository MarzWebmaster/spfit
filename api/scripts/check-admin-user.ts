import { AppDataSource } from '../config/database';
import { User } from '../models/User';
import { Role } from '../models/Role';

async function checkAdminUser() {
  try {
    console.log('🔍 Initializing database connection...');
    await AppDataSource.initialize();
    console.log('✅ Database connected successfully');

    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);

    // Check if admin user exists
    console.log('\n🔍 Checking for admin user...');
    const adminUser = await userRepository.findOne({
      where: { email: 'admin@marz.my' },
      relations: ['role']
    });

    if (adminUser) {
      console.log('✅ Admin user found:');
      console.log(`   ID: ${adminUser.id}`);
      console.log(`   Name: ${adminUser.name}`);
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   Status: ${adminUser.status}`);
      console.log(`   Role ID: ${adminUser.role_id}`);
      console.log(`   Role Name: ${adminUser.role?.name || 'N/A'}`);
      console.log(`   Created: ${adminUser.created_at}`);
      
      console.log(`   Password Hash: ${adminUser.password_hash.substring(0, 20)}...`);
    } else {
      console.log('❌ Admin user not found!');
      
      // Check all users
      console.log('\n📋 All users in database:');
      const allUsers = await userRepository.find({
        relations: ['role']
      });
      
      if (allUsers.length === 0) {
        console.log('   No users found in database');
      } else {
        allUsers.forEach(user => {
          console.log(`   - ${user.name} (${user.email}) - Role: ${user.role?.name || 'N/A'} - Status: ${user.status}`);
        });
      }
    }

    // Check roles
    console.log('\n🎭 Available roles:');
    const roles = await roleRepository.find();
    roles.forEach(role => {
      console.log(`   - ${role.name} (ID: ${role.id}) - ${role.description}`);
    });

    await AppDataSource.destroy();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAdminUser();