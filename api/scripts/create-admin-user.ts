import { AppDataSource } from '../config/database';
import { User, UserStatus } from '../models/User';
import { Role } from '../models/Role';
import { AuthService } from '../services/authService';

/**
 * Script to create admin user with specified credentials
 * Email: admin@marz.my
 * Password: admin
 */
async function createAdminUser() {
  try {
    // Initialize database connection
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('Database connection initialized');
    }

    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);
    const authService = new AuthService();

    const adminEmail = 'admin@marz.my';
    const adminPassword = 'admin123';

    // Check if user already exists
    const existingUser = await userRepository.findOne({
      where: { email: adminEmail }
    });

    if (existingUser) {
      console.log(`User with email ${adminEmail} already exists. Ensuring admin privileges and updating password...`);

      // Ensure Admin role exists
      const adminRoleEnsure = await roleRepository.findOne({ where: { name: 'Admin' } });
      if (!adminRoleEnsure) {
        console.error('Admin role not found. Please run database migrations first.');
        return;
      }

      // Hash the new password
      const passwordHash = await authService.hashPassword(adminPassword);

      // Update the existing user's details
      existingUser.password_hash = passwordHash;
      existingUser.role_id = adminRoleEnsure.id;
      existingUser.status = UserStatus.AKTIF as any;
      if (!existingUser.name || existingUser.name.trim() === '') {
        existingUser.name = 'Admin Staff';
      }
      existingUser.updated_at = new Date();

      const updatedUser = await userRepository.save(existingUser);

      console.log('Admin user updated successfully!');
      console.log('User details:', {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        status: updatedUser.status,
        role_id: updatedUser.role_id
      });

      console.log('\nLogin credentials:');
      console.log(`Email: ${adminEmail}`);
      console.log(`Password: ${adminPassword}`);

      return;
    }

    // Get Admin role (should be ID 1 based on migration)
    const adminRole = await roleRepository.findOne({
      where: { name: 'Admin' }
    });

    if (!adminRole) {
      console.error('Admin role not found. Please run database migrations first.');
      return;
    }

    console.log(`Found Admin role with ID: ${adminRole.id}`);

    // Hash the password
    const passwordHash = await authService.hashPassword(adminPassword);
    console.log('Password hashed successfully');

    // Create the admin user
    const adminUser = userRepository.create({
      name: 'Admin Staff',
      email: adminEmail,
      password_hash: passwordHash,
      role_id: adminRole.id,
      status: UserStatus.AKTIF as any,
      is_available: false, // Admin users are typically not available for task assignment
      created_at: new Date(),
      updated_at: new Date()
    });

    // Save the user
    const savedUser = await userRepository.save(adminUser);
    
    console.log('Admin user created successfully!');
    console.log('User details:', {
      id: savedUser.id,
      name: savedUser.name,
      email: savedUser.email,
      role_id: savedUser.role_id,
      status: savedUser.status
    });

    console.log('\nLogin credentials:');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    // Close database connection
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('Database connection closed');
    }
  }
}

// Run the script
createAdminUser();

export { createAdminUser };
