import { AppDataSource } from '../config/database';
import { Role } from '../models/Role';

async function run() {
  try {
    await AppDataSource.initialize();
    const roleRepo = AppDataSource.getRepository(Role);

    // Find the Freelancer role
    const freelancerRole = await roleRepo.findOne({ where: { name: 'Freelancer' } });
    
    if (!freelancerRole) {
      console.error('❌ Freelancer role not found in database');
      process.exit(1);
    }

    console.log(`📋 Current status of Freelancer role:`);
    console.log(`   ID: ${freelancerRole.id}`);
    console.log(`   Name: ${freelancerRole.name}`);
    console.log(`   is_system_role: ${freelancerRole.is_system_role}`);

    // Only non-system roles like Admin, Super Admin should be system roles
    // Freelancer should be editable
    if (freelancerRole.is_system_role) {
      freelancerRole.is_system_role = false;
      await roleRepo.save(freelancerRole);
      console.log('\n✅ Fixed! Freelancer role is_system_role set to FALSE');
      console.log('   You can now edit the Freelancer role permissions.');
    } else {
      console.log('\n✅ Freelancer role is already editable (is_system_role = FALSE)');
    }

  } catch (error) {
    console.error('❌ Error fixing Freelancer role:', error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

run();
