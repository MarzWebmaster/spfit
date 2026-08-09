import { AppDataSource } from '../config/database';
import { Role } from '../models/Role';
import { RolePermission } from '../models/RolePermission';
import { User, UserStatus } from '../models/User';
import bcrypt from 'bcryptjs';

const PERMISSIONS = {
  ADMIN: [
    'tasks:create', 'tasks:view:all', 'tasks:view:own', 'tasks:view:assigned', 'tasks:assign', 'tasks:edit:all', 'tasks:delete', 'tasks:submit_report', 'tasks:verify_report',
    'projects:view:all', 'projects:view:own',
    'masterlists:view:all', 'masterlists:view:own',
    'assets:view:all', 'assets:view:own',
    'payments:view:all', 'payments:view:own', 'payments:approve', 'payments:mark_paid',
    'freelancers:manage', 'freelancers:view:all', 'freelancers:view:own',
    'reports:view:all', 'reports:view:own',
    'notifications:view', 'notifications:view:all', 'notifications:view:own',
    'maincons:view:all', 'maincons:view:own',
    'settings:view', 'settings:manage:profile', 'settings:manage:users', 'settings:manage:roles', 'settings:manage:mail', 'settings:manage:templates', 'settings:manage:api'
  ],
  STAFF: [
    'tasks:create', 'tasks:view:all', 'tasks:view:own', 'tasks:assign', 'tasks:edit:all', 'tasks:verify_report',
    'projects:view:all', 'masterlists:view:all', 'assets:view:all',
    'freelancers:view:all',
    'reports:view:all',
    'notifications:view', 'notifications:view:all',
    'maincons:view:all',
    'settings:view', 'settings:manage:profile'
  ],
  SUPERVISOR: [
    'tasks:create', 'tasks:view:all', 'tasks:view:own', 'tasks:assign', 'tasks:edit:all', 'tasks:verify_report',
    'projects:view:all', 'masterlists:view:all', 'assets:view:all',
    'payments:view:all', 'payments:approve',
    'freelancers:manage', 'freelancers:view:all',
    'reports:view:all',
    'notifications:view', 'notifications:view:all',
    'maincons:view:all',
    'settings:view', 'settings:manage:profile'
  ],
  FREELANCER: [
    'tasks:view:own', 'tasks:view:assigned', 'tasks:submit_report',
    'projects:view:own', 'masterlists:view:own', 'assets:view:own',
    'payments:view:own',
    'freelancers:view:own',
    'reports:view:own',
    'notifications:view:own',
    'maincons:view:own',
    'settings:manage:profile'
  ]
};

async function setup() {
  try {
    console.log('Initializing database connection...');
    await AppDataSource.initialize();
    console.log('Database connected.');

    const roleRepository = AppDataSource.getRepository(Role);
    const permissionRepository = AppDataSource.getRepository(RolePermission);
    const userRepository = AppDataSource.getRepository(User);

    // One-time normalization for older permission id.
    await permissionRepository
      .createQueryBuilder()
      .update(RolePermission)
      .set({ permission: 'freelancers:view:all' })
      .where('permission = :legacyPermission', { legacyPermission: 'freelancers:view_all' })
      .execute();

    // 1. Setup Roles and Permissions
    const rolesData = [
      { name: 'Admin', description: 'Administrator with full access', permissions: PERMISSIONS.ADMIN },
      { name: 'Staff', description: 'Internal staff member', permissions: PERMISSIONS.STAFF },
      { name: 'Supervisor', description: 'Team supervisor', permissions: PERMISSIONS.SUPERVISOR },
      { name: 'Freelancer', description: 'External freelancer', permissions: PERMISSIONS.FREELANCER },
    ];

    for (const rData of rolesData) {
      let role = await roleRepository.findOne({ where: { name: rData.name } });
      
      if (!role) {
        console.log(`Creating role: ${rData.name}`);
        role = roleRepository.create({
          name: rData.name,
          description: rData.description,
          is_system_role: true
        });
        await roleRepository.save(role);
      } else {
        console.log(`Role ${rData.name} exists. Updating...`);
        role.description = rData.description;
        role.is_system_role = true;
        await roleRepository.save(role);
      }

      // Sync Permissions
      console.log(`Syncing permissions for ${rData.name}...`);
      // Remove existing permissions
      await permissionRepository.delete({ role_id: role.id });
      
      // Add new permissions
      const permissions = rData.permissions.map(p => {
        const rp = new RolePermission();
        rp.role_id = role.id;
        rp.permission = p;
        return rp;
      });
      await permissionRepository.save(permissions);
    }

    // 2. Setup Admin User
    const adminEmail = 'admin@marz.my';
    let adminUser = await userRepository.findOne({ where: { email: adminEmail } });
    const adminRole = await roleRepository.findOne({ where: { name: 'Admin' } });

    if (!adminRole) {
      throw new Error('Admin role not found after seeding!');
    }

    if (!adminUser) {
      console.log(`Creating admin user: ${adminEmail}`);
      const hashedPassword = await bcrypt.hash('admin123', 10);
      adminUser = userRepository.create({
        name: 'Admin System',
        email: adminEmail,
        password_hash: hashedPassword,
        role_id: adminRole.id,
        status: UserStatus.AKTIF
      });
      // Note: If 'role' relation exists, TypeORM usually handles roleId automatically if defined in entity, 
      // but let's check User entity definition if needed. 
      // Based on previous reads, User has roleId column or relation.
      // Let's assume roleId is the foreign key column.
      
      // Explicitly setting the relation
      adminUser.role = adminRole;
      
      await userRepository.save(adminUser);
      console.log(`Admin user created.`);
    } else {
      console.log(`Admin user exists. Updating role to Admin...`);
      adminUser.role = adminRole;
      adminUser.role_id = adminRole.id;
      adminUser.status = UserStatus.AKTIF;
      // Optional: Reset password if needed, but user provided specific password.
      // Let's ensure password is correct just in case.
      const hashedPassword = await bcrypt.hash('admin123', 10);
      adminUser.password_hash = hashedPassword;
      
      await userRepository.save(adminUser);
      console.log(`Admin user updated.`);
    }

    console.log('Setup completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error during setup:', error);
    process.exit(1);
  }
}

setup();
