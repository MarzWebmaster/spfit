import api from './api';
import { getApiBaseUrl } from '../utils/apiUrl';

export interface SystemSetting {
  id: number;
  setting_key: string;
  setting_value: string;
  description?: string;
  data_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SettingsResponse {
  success: boolean;
  message: string;
  data: {
    settings: SystemSetting[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export interface SingleSettingResponse {
  success: boolean;
  message: string;
  data: {
    setting: SystemSetting;
  };
}

class SettingsService {
  /**
   * Get all system settings
   */
  async getAllSettings(params?: {
    page?: number;
    limit?: number;
    search?: string;
    is_active?: boolean;
    data_type?: string;
  }): Promise<SettingsResponse> {
    const response = await api.system.getAllSettings({
      page: params?.page,
      limit: params?.limit,
      search: params?.search,
      is_active: params?.is_active,
      data_type: params?.data_type,
    });
    return response as SettingsResponse;
  }

  /**
   * Get system setting by key
   */
  async getSettingByKey(key: string): Promise<SingleSettingResponse> {
    const response = await api.system.getSettingByKey(key);
    return response as SingleSettingResponse;
  }

  /**
   * Create new system setting
   */
  async createSetting(data: {
    key: string;
    value: string;
    description?: string;
    category?: string;
    is_public?: boolean;
  }): Promise<SingleSettingResponse> {
    const response = await api.system.createSetting(data);
    return response as SingleSettingResponse;
  }

  /**
   * Update system setting
   */
  async updateSetting(key: string, data: {
    setting_value: string;
    description?: string;
    is_active?: boolean;
  }): Promise<SingleSettingResponse> {
    // Attempt update; if setting doesn't exist, create it instead
    const updateResponse = await api.system.updateSetting(key, {
      setting_value: data.setting_value,
      description: data.description,
      is_active: data.is_active
    } as any);

    if (!updateResponse.success) {
      const msg = (updateResponse as any).error || (updateResponse as any).message || '';
      const notFound = typeof msg === 'string' && msg.toLowerCase().includes('not found');
      if (notFound) {
        const createResponse = await api.system.createSetting({
          key,
          value: data.setting_value,
          description: data.description,
          is_public: false,
          category: 'general'
        });
        return createResponse as SingleSettingResponse;
      }
    }

    return updateResponse as SingleSettingResponse;
  }

  /**
   * Delete system setting
   */
  async deleteSetting(key: string): Promise<{ success: boolean; message: string }> {
    await api.system.deleteSetting(key);
    return { success: true, message: 'Setting deleted' };
  }

  /**
   * Get multiple settings by keys from public endpoint
   */
  async getSettingsByKeys(keys: string[]): Promise<Record<string, string>> {
    try {
      // Use public endpoint that doesn't require authentication
      const base = getApiBaseUrl();
      const response = await fetch(`${base}/system/settings/public`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data.settings) {
        // Filter only requested keys
        const filteredSettings: Record<string, string> = {};
        keys.forEach(key => {
          if (data.data.settings[key]) {
            filteredSettings[key] = data.data.settings[key];
          }
        });
        return filteredSettings;
      }
      
      return {};
    } catch (error) {
      console.error('Error fetching public settings:', error);
      return {};
    }
  }

  /**
   * Initialize default settings if they don't exist
   */
  async initializeDefaultSettings(): Promise<void> {
    const defaultSettings = [
      {
        key: 'spfit_webhooks',
        value: JSON.stringify([]),
        description: 'System webhooks configuration'
      },
      {
        key: 'spfit_notification_templates',
        value: JSON.stringify([]),
        description: 'Notification templates configuration'
      },
      {
        key: 'spfit_roles',
        value: JSON.stringify([]),
        description: 'System roles configuration'
      },
      {
        key: 'spfit_default_freelancer_role_id',
        value: '',
        description: 'Default freelancer role ID'
      },
      {
        key: 'spfit_smtp_settings',
        value: JSON.stringify({}),
        description: 'SMTP email settings'
      }
    ];

    for (const setting of defaultSettings) {
      try {
        // Check if setting exists
        await this.getSettingByKey(setting.key);
      } catch (error) {
        // Setting doesn't exist, create it
        try {
          await this.createSetting(setting);
          console.log(`Created default setting: ${setting.key}`);
        } catch (createError) {
          console.error(`Error creating setting ${setting.key}:`, createError);
        }
      }
    }
  }

  /**
   * Migrate data from localStorage to database
   */
  async migrateFromLocalStorage(): Promise<void> {
    const localStorageKeys = [
      'spfit_webhooks',
      'spfit_notification_templates', 
      'spfit_roles',
      'spfit_default_freelancer_role_id',
      'spfit_smtp_settings'
    ];

    for (const key of localStorageKeys) {
      const localValue = localStorage.getItem(key);
      if (localValue) {
        try {
          // Check if setting exists in database
          await this.getSettingByKey(key);
          
          // Update existing setting with localStorage value
          await this.updateSetting(key, {
            setting_value: localValue
          });
          
          console.log(`Migrated ${key} from localStorage to database`);
          
          // Remove from localStorage after successful migration
          localStorage.removeItem(key);
        } catch (error) {
          // Setting doesn't exist, create it
          try {
            await this.createSetting({
              key,
              value: localValue,
              description: `Migrated from localStorage: ${key}`
            });
            
            console.log(`Created and migrated ${key} from localStorage`);
            localStorage.removeItem(key);
          } catch (createError) {
            console.error(`Error migrating ${key}:`, createError);
          }
        }
      }
    }
  }
}

export const settingsService = new SettingsService();
export default settingsService;
