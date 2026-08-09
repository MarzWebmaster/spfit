import { AppDataSource } from '../config/database';
import { Role } from '../models/Role';

async function addRoleTypeColumn() {
  try {
    console.log('Initializing database connection...');
    await AppDataSource.initialize();
    console.log('Database connected.');

    const queryRunner = AppDataSource.createQueryRunner();
    
    // Check if column exists
    const table = await queryRunner.getTable('roles');
    const columnExists = table?.columns.find(c => c.name === 'role_type');

    if (!columnExists) {
      console.log('Adding role_type column...');
      await queryRunner.query(`ALTER TABLE roles ADD COLUMN role_type VARCHAR(50) DEFAULT 'Operasi' AFTER description`);
      console.log('Column added.');
    } else {
        console.log('Column role_type already exists.');
    }

    // Update existing roles
    console.log('Updating existing roles...');
    
    // Admin -> Pentadbiran
    await queryRunner.query(`UPDATE roles SET role_type = 'Pentadbiran' WHERE name = 'Admin'`);
    
    // Staff -> Operasi
    await queryRunner.query(`UPDATE roles SET role_type = 'Operasi' WHERE name = 'Staff'`);
    
    // Supervisor -> Pengurusan
    await queryRunner.query(`UPDATE roles SET role_type = 'Pengurusan' WHERE name = 'Supervisor'`);
    
    // Freelancer -> Luaran
    await queryRunner.query(`UPDATE roles SET role_type = 'Luaran' WHERE name = 'Freelancer' OR name = 'Freelance Tech'`);

    console.log('Roles updated successfully.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error migrating roles:', error);
    process.exit(1);
  }
}

addRoleTypeColumn();
