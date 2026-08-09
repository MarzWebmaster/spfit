import { AppDataSource } from '../config/database';
import { Role } from '../models/Role';
import { SystemSettings } from '../models/SystemSettings';

async function run() {
  try {
    await AppDataSource.initialize();
    const roleRepo = AppDataSource.getRepository(Role);
    const settingsRepo = AppDataSource.getRepository(SystemSettings);

    const freelancer = await roleRepo.findOne({ where: { name: 'Freelancer' } });
    if (!freelancer) {
      console.error('Freelancer role not found in DB.');
      process.exit(1);
    }

    const key = 'spfit_default_freelancer_role_id';
    let setting = await settingsRepo.findOne({ where: { setting_key: key } });

    if (!setting) {
      setting = settingsRepo.create({
        setting_key: key,
        setting_value: String(freelancer.id),
        description: 'Default role id for new freelancers',
        data_type: 'string',
        is_active: true
      });
      await settingsRepo.save(setting);
      console.log(`Created setting ${key}=${freelancer.id}`);
    } else {
      setting.setting_value = String(freelancer.id);
      await settingsRepo.save(setting);
      console.log(`Updated setting ${key}=${freelancer.id}`);
    }
  } catch (e) {
    console.error('Error fixing default freelancer role setting:', e);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

run();
