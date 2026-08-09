
import { AppDataSource } from '../config/database';
import { SystemSettings } from '../models/SystemSettings';

async function checkSettings() {
    try {
        await AppDataSource.initialize();
        console.log('Database connected');

        const repository = AppDataSource.getRepository(SystemSettings);
        const setting = await repository.findOne({
            where: { setting_key: 'spfit_default_freelancer_role_id' }
        });

        console.log('Current Setting:', setting);
        
        const allSettings = await repository.find();
        console.log('All Settings Keys:', allSettings.map(s => s.setting_key));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await AppDataSource.destroy();
    }
}

checkSettings();
