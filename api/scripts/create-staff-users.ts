import 'reflect-metadata';
import { AppDataSource } from '../config/database';
import { User, UserStatus } from '../models/User';
import { Role } from '../models/Role';
import { AuthService } from '../services/authService';

/**
 * Script to create staff users for testing
 * Ahmad (Staff): ahmad@spfit.com / staff123
 * Siti (Staff): siti@spfit.com / staff123
 */
async function createStaffUsers() {
  try {
    console.log('Connecting to database...');
    await AppDataSource.initialize();
    console.log('Database connected successfully');

    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);
    const authService = new AuthService();

    // Get Staff role (should be ID 1 based on constants)
    const staffRole = await roleRepository.findOne({
      where: { name: 'Staff' }
    });

    if (!staffRole) {
      console.error('Staff role not found. Please run database migrations first.');
      process.exit(1);
    }

    console.log(`Found Staff role with ID: ${staffRole.id}`);

    // Staff users to create
    const staffUsers = [
      {
        name: 'Ahmad (Staff)',
        email: 'ahmad@spfit.com',
        password: 'staff123'
      },
      {
        name: 'Siti (Staff)', 
        email: 'siti@spfit.com',
        password: 'staff123'
      }
    ];

    for (const userData of staffUsers) {
      // Check if user already exists
      const existingUser = await userRepository.findOne({
        where: { email: userData.email }
      });

      if (existingUser) {
        console.log(`User ${userData.email} already exists. Skipping...`);
        continue;
      }

      // Hash password
      const hashedPassword = await authService.hashPassword(userData.password);

      // Create new user
      const newUser = userRepository.create({
        name: userData.name,
        email: userData.email,
        password_hash: hashedPassword,
        role: staffRole,
        status: UserStatus.AKTIF
      });

      await userRepository.save(newUser);
      console.log(`Created staff user: ${userData.name} (${userData.email})`);
    }

    console.log('\n=== Staff Users Created Successfully ===');
    console.log('Login credentials:');
    console.log('Ahmad: ahmad@spfit.com / staff123');
    console.log('Siti: siti@spfit.com / staff123');

  } catch (error) {
    console.error('Error creating staff users:', error);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

// Run the script
if (require.main === module) {
  createStaffUsers();
}

export { createStaffUsers };