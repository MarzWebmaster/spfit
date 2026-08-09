import { AppDataSource } from '../config/database';
import { Role } from '../models/Role';

const ROLES_TO_SEED = [
  {
    name: 'Admin',
    description: 'Administrator with full access',
    is_system_role: true
  },
  {
    name: 'Staff',
    description: 'Internal staff member',
    is_system_role: true
  },
  {
    name: 'Supervisor',
    description: 'Team supervisor',
    is_system_role: true
  },
  {
    name: 'Freelancer',
    description: 'External freelancer',
    is_system_role: true
  }
];

async function seedRoles() {
  try {
    console.log('Initializing database connection...');
    await AppDataSource.initialize();
    console.log('Database connected.');

    const roleRepository = AppDataSource.getRepository(Role);

    for (const roleData of ROLES_TO_SEED) {
      const existingRole = await roleRepository.findOne({ where: { name: roleData.name } });
      
      if (!existingRole) {
        console.log(`Creating role: ${roleData.name}`);
        const newRole = roleRepository.create(roleData);
        await roleRepository.save(newRole);
        console.log(`Role ${roleData.name} created.`);
      } else {
        console.log(`Role ${roleData.name} already exists.`);
        // Optional: Update description or is_system_role if needed
        if (existingRole.is_system_role !== roleData.is_system_role) {
          existingRole.is_system_role = roleData.is_system_role;
            await roleRepository.save(existingRole);
          console.log(`Updated is_system_role for ${roleData.name}`);
        }
      }
    }

    console.log('Role seeding completed.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding roles:', error);
    process.exit(1);
  }
}

seedRoles();
