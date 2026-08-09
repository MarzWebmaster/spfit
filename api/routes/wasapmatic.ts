import { Router, Request, Response } from 'express';
import axios from 'axios';
import { AppDataSource } from '../config/database.ts';
import { SystemSettings } from '../models/SystemSettings.ts';
import { Notification, NotificationType } from '../models/Notification.ts';
import { User, UserStatus } from '../models/User.ts';
import { AuditService } from '../services/auditService.js';
import Joi from 'joi';
import { enqueueWhatsAppMessage } from '../services/messageQueueService.ts';
import { normalizeMsisdn } from '../utils/phone.ts';
import { encrypt, decrypt, isEncrypted } from '../utils/encryption.ts';
import { authenticateToken, requirePermission } from '../middleware/auth.ts';

const router = Router();

type WhatsAppProvider = 'wasapmatic' | 'marz';

const DEFAULT_WASAPMATIC_API_URL = 'https://app.wasapmatic.com/api';
const DEFAULT_MARZ_API_URL = 'http://wasap.marz.biz.my/api';
const ACTIVE_PROVIDER_KEY = 'whatsapp_active_provider';
const NO_ACTIVE_PROVIDER_ALERT_KEY = 'whatsapp_no_active_provider_alert_at';
const NO_ACTIVE_PROVIDER_ALERT_COOLDOWN_MS = 10 * 60 * 1000;

let WASAPMATIC_API_URL = process.env.WASAPMATIC_API_URL || DEFAULT_WASAPMATIC_API_URL;
let WASAPMATIC_API_KEY = process.env.WASAPMATIC_API_KEY || '';
let WASAPMATIC_DEVICE_ID = process.env.WASAPMATIC_DEVICE_ID || '';
let MARZ_WASAP_API_URL = process.env.MARZ_WASAP_API_URL || DEFAULT_MARZ_API_URL;
let MARZ_WASAP_API_SECRET = process.env.MARZ_WASAP_API_SECRET || '';
let MARZ_WASAP_ACCOUNT_ID = process.env.MARZ_WASAP_ACCOUNT_ID || '';
let ACTIVE_PROVIDER: WhatsAppProvider | null = (process.env.WHATSAPP_ACTIVE_PROVIDER as WhatsAppProvider) || null;

const getSettingsRepo = () => AppDataSource.getRepository(SystemSettings);

const decodeMaybeEncrypted = (value: string | null) => {
  if (!value) return value;
  if (!isEncrypted(value)) return value;
  return decrypt(value) || value;
};

const upsertSetting = async (
  settingKey: string,
  settingValue: string,
  description: string,
  dataType = 'string',
) => {
  const settingsRepository = getSettingsRepo();
  let setting = await settingsRepository.findOne({ where: { setting_key: settingKey } });

  if (setting) {
    setting.setting_value = settingValue;
    setting.description = description;
    setting.data_type = dataType;
    setting.is_active = true;
    await settingsRepository.save(setting);
    return;
  }

  setting = settingsRepository.create({
    setting_key: settingKey,
    setting_value: settingValue,
    description,
    data_type: dataType,
    is_active: true,
  });
  await settingsRepository.save(setting);
};

const getActiveProviderFromDB = async (): Promise<WhatsAppProvider | null> => {
  try {
    if (!AppDataSource.isInitialized) return ACTIVE_PROVIDER;
    const setting = await getSettingsRepo().findOne({ where: { setting_key: ACTIVE_PROVIDER_KEY } });
    const value = (setting?.setting_value || '').trim().toLowerCase();
    if (value === 'wasapmatic' || value === 'marz') return value;
    return null;
  } catch {
    return ACTIVE_PROVIDER;
  }
};

const setActiveProvider = async (provider: WhatsAppProvider | null) => {
  const normalized = provider || 'none';
  if (AppDataSource.isInitialized) {
    await upsertSetting(ACTIVE_PROVIDER_KEY, normalized, 'Active WhatsApp provider (wasapmatic|marz|none)');
  }
  ACTIVE_PROVIDER = provider;
};

const getWasapmaticConfigFromDB = async () => {
  try {
    if (!AppDataSource.isInitialized) {
      return { apiKey: null, deviceId: null, apiUrl: null };
    }

    const settingsRepository = getSettingsRepo();
    const [apiKeySetting, deviceIdSetting, apiUrlSetting] = await Promise.all([
      settingsRepository.findOne({ where: { setting_key: 'wasapmatic_api_key' } }),
      settingsRepository.findOne({ where: { setting_key: 'wasapmatic_device_id' } }),
      settingsRepository.findOne({ where: { setting_key: 'wasapmatic_api_url' } }),
    ]);

    return {
      apiKey: decodeMaybeEncrypted(apiKeySetting?.setting_value || null),
      deviceId: decodeMaybeEncrypted(deviceIdSetting?.setting_value || null),
      apiUrl: apiUrlSetting?.setting_value || null,
    };
  } catch (error) {
    console.error('Error fetching Wasapmatic config from DB:', error);
    return { apiKey: null, deviceId: null, apiUrl: null };
  }
};

const saveWasapmaticConfigToDB = async (apiKey: string, deviceId: string, apiUrl?: string): Promise<boolean> => {
  try {
    if (!AppDataSource.isInitialized) return false;

    await upsertSetting('wasapmatic_api_key', encrypt(apiKey), 'Wasapmatic API Key');
    await upsertSetting('wasapmatic_device_id', encrypt(deviceId), 'Wasapmatic Device ID');
    await upsertSetting(
      'wasapmatic_api_url',
      apiUrl || DEFAULT_WASAPMATIC_API_URL,
      'Wasapmatic API Base URL',
    );

    return true;
  } catch (error) {
    console.error('Error saving Wasapmatic config to DB:', error);
    return false;
  }
};

const getMarzConfigFromDB = async () => {
  try {
    if (!AppDataSource.isInitialized) {
      return { apiSecret: null, accountId: null, apiUrl: null };
    }

    const settingsRepository = getSettingsRepo();
    const [secretSetting, accountSetting, apiUrlSetting] = await Promise.all([
      settingsRepository.findOne({ where: { setting_key: 'marz_wasap_api_secret' } }),
      settingsRepository.findOne({ where: { setting_key: 'marz_wasap_account_id' } }),
      settingsRepository.findOne({ where: { setting_key: 'marz_wasap_api_url' } }),
    ]);

    return {
      apiSecret: decodeMaybeEncrypted(secretSetting?.setting_value || null),
      accountId: decodeMaybeEncrypted(accountSetting?.setting_value || null),
      apiUrl: apiUrlSetting?.setting_value || null,
    };
  } catch (error) {
    console.error('Error fetching Marz Wasap config from DB:', error);
    return { apiSecret: null, accountId: null, apiUrl: null };
  }
};

const saveMarzConfigToDB = async (apiSecret: string, accountId: string): Promise<boolean> => {
  try {
    if (!AppDataSource.isInitialized) return false;

    await upsertSetting('marz_wasap_api_secret', encrypt(apiSecret), 'Marz Wasap API Secret');
    await upsertSetting('marz_wasap_account_id', encrypt(accountId), 'Marz Wasap WhatsApp Account ID');
    await upsertSetting(
      'marz_wasap_api_url',
      DEFAULT_MARZ_API_URL,
      'Marz Wasap API Base URL',
    );

    return true;
  } catch (error) {
    console.error('Error saving Marz Wasap config to DB:', error);
    return false;
  }
};

const isWasapmaticConfigured = () => !!WASAPMATIC_API_KEY && !!WASAPMATIC_DEVICE_ID;
const isMarzConfigured = () => !!MARZ_WASAP_API_SECRET && !!MARZ_WASAP_ACCOUNT_ID;

const resolveActiveProvider = async (): Promise<WhatsAppProvider | null> => {
  const active = await getActiveProviderFromDB();

  if (active === 'wasapmatic') {
    return isWasapmaticConfigured() ? 'wasapmatic' : null;
  }

  if (active === 'marz') {
    return isMarzConfigured() ? 'marz' : null;
  }

  return null;
};

const notifyAdminStaffNoActiveProvider = async (context?: { requestedById?: number; targetPhone?: string }) => {
  try {
    if (!AppDataSource.isInitialized) return;

    const settingsRepo = getSettingsRepo();
    const alertSetting = await settingsRepo.findOne({ where: { setting_key: NO_ACTIVE_PROVIDER_ALERT_KEY } });
    const now = Date.now();
    const lastAlertAt = alertSetting?.setting_value ? new Date(alertSetting.setting_value).getTime() : 0;

    if (lastAlertAt && !Number.isNaN(lastAlertAt) && now - lastAlertAt < NO_ACTIVE_PROVIDER_ALERT_COOLDOWN_MS) {
      return;
    }

    const userRepo = AppDataSource.getRepository(User);
    const notificationRepo = AppDataSource.getRepository(Notification);

    const recipients = await userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.status = :status', { status: UserStatus.AKTIF })
      .andWhere('LOWER(role.name) IN (:...roles)', { roles: ['admin', 'staff'] })
      .getMany();

    if (recipients.length > 0) {
      const messageTarget = context?.targetPhone ? ` Destinasi: ${context.targetPhone}.` : '';
      const messageRequester = context?.requestedById ? ` Trigger user ID: ${context.requestedById}.` : '';

      const notifications = recipients.map((recipient) =>
        notificationRepo.create({
          user_id: recipient.id,
          task_id: null,
          type: NotificationType.SYSTEM_ANNOUNCEMENT,
          title: 'WhatsApp Provider Tidak Aktif',
          message: `Penghantaran WhatsApp gagal kerana tiada provider aktif (Wasapmatic/Marz Wasap). Sila aktifkan provider di Tetapan > Integrasi AI & Messaging.${messageTarget}${messageRequester}`,
          is_read: false,
          created_at: new Date(),
        }),
      );

      await notificationRepo.save(notifications);
    }

    await upsertSetting(
      NO_ACTIVE_PROVIDER_ALERT_KEY,
      new Date().toISOString(),
      'Last timestamp when no active WhatsApp provider alert was sent to admin/staff',
    );
  } catch (error) {
    console.error('Failed to create no-active-provider notifications:', error);
  }
};

export const initializeWasapmaticConfig = async () => {
  try {
    const [wasapmaticConfig, marzConfig, activeProvider] = await Promise.all([
      getWasapmaticConfigFromDB(),
      getMarzConfigFromDB(),
      getActiveProviderFromDB(),
    ]);

    if (wasapmaticConfig.apiKey) {
      WASAPMATIC_API_KEY = wasapmaticConfig.apiKey;
      console.log('✅ Wasapmatic API key loaded from database');
    }
    if (wasapmaticConfig.deviceId) {
      WASAPMATIC_DEVICE_ID = wasapmaticConfig.deviceId;
      console.log('✅ Wasapmatic Device ID loaded from database');
    }
    if (wasapmaticConfig.apiUrl) {
      WASAPMATIC_API_URL = wasapmaticConfig.apiUrl;
      console.log('✅ Wasapmatic API URL loaded from database:', wasapmaticConfig.apiUrl);
    }

    if (marzConfig.apiSecret) {
      MARZ_WASAP_API_SECRET = marzConfig.apiSecret;
      console.log('✅ Marz Wasap API secret loaded from database');
    }
    if (marzConfig.accountId) {
      MARZ_WASAP_ACCOUNT_ID = marzConfig.accountId;
      console.log('✅ Marz Wasap account ID loaded from database');
    }

    MARZ_WASAP_API_URL = DEFAULT_MARZ_API_URL;
    console.log('✅ Marz Wasap API URL hardcoded to default:', DEFAULT_MARZ_API_URL);

    ACTIVE_PROVIDER = activeProvider;
    console.log(`✅ Active WhatsApp provider: ${ACTIVE_PROVIDER || 'none'}`);
  } catch (error) {
    console.error('❌ Failed to initialize WhatsApp provider config:', error);
  }
};

router.get('/providers/status', authenticateToken, requirePermission('settings:manage:api'), async (_req: Request, res: Response) => {
  try {
    const activeProvider = await getActiveProviderFromDB();
    res.json({
      success: true,
      data: {
        activeProvider,
        providers: {
          wasapmatic: {
            configured: isWasapmaticConfigured(),
            active: activeProvider === 'wasapmatic',
            apiUrl: WASAPMATIC_API_URL,
          },
          marz: {
            configured: isMarzConfigured(),
            active: activeProvider === 'marz',
            apiUrl: MARZ_WASAP_API_URL,
          },
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to get provider status' });
  }
});

router.post('/providers/active', authenticateToken, requirePermission('settings:manage:api'), async (req: Request, res: Response) => {
  try {
    const schema = Joi.object({
      provider: Joi.string().valid('wasapmatic', 'marz').allow(null).required(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: `Validation failed: ${error.message}` });
    }

    const provider = value.provider as WhatsAppProvider | null;
    if (provider === 'wasapmatic' && !isWasapmaticConfigured()) {
      return res.status(400).json({ success: false, message: 'Wasapmatic belum lengkap. Sila simpan konfigurasi dahulu.' });
    }
    if (provider === 'marz' && !isMarzConfigured()) {
      return res.status(400).json({ success: false, message: 'Marz Wasap belum lengkap. Sila simpan konfigurasi dahulu.' });
    }

    await setActiveProvider(provider);
    return res.json({
      success: true,
      message: provider ? `Provider aktif ditetapkan kepada ${provider}` : 'Tiada provider aktif ditetapkan',
      data: { activeProvider: provider },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to update active provider' });
  }
});

router.get('/profile', authenticateToken, requirePermission('settings:manage:api'), async (_req: Request, res: Response) => {
  if (!isWasapmaticConfigured()) {
    return res.status(400).json({
      success: false,
      message: 'Wasapmatic not configured. Please set API key and Device ID.',
    });
  }

  try {
    const response = await axios.get(`${WASAPMATIC_API_URL}/get/credits`, {
      params: { secret: WASAPMATIC_API_KEY },
    });

    res.json({ success: true, data: response.data });
  } catch (error: any) {
    console.error('Wasapmatic profile error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to get profile',
    });
  }
});

router.get('/marz/profile', authenticateToken, requirePermission('settings:manage:api'), async (_req: Request, res: Response) => {
  if (!isMarzConfigured()) {
    return res.status(400).json({
      success: false,
      message: 'Marz Wasap not configured. Please set API secret and account ID.',
    });
  }

  try {
    const response = await axios.get(`${MARZ_WASAP_API_URL}/get/credits`, {
      params: { secret: MARZ_WASAP_API_SECRET },
    });

    res.json({ success: true, data: response.data });
  } catch (error: any) {
    console.error('Marz Wasap profile error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to get profile',
    });
  }
});

router.post('/send', authenticateToken, requirePermission('settings:manage:api'), async (req: Request, res: Response) => {
  try {
    const activeProvider = await resolveActiveProvider();
    if (!activeProvider) {
      await notifyAdminStaffNoActiveProvider({ requestedById: req.user?.id, targetPhone: req.body?.to });
      return res.status(400).json({
        success: false,
        message: 'Tiada WhatsApp API aktif. Sila aktifkan Wasapmatic atau Marz Wasap di Integrasi AI & Messaging.',
      });
    }

    const schema = Joi.object({
      to: Joi.string().pattern(/^\+?\d{9,15}$/).required(),
      message: Joi.string().min(1).max(1000).required(),
      correlation_id: Joi.string().optional(),
      freelancer_id: Joi.number().optional(),
      freelancer_name: Joi.string().optional(),
      task_id: Joi.number().optional(),
      task_title: Joi.string().optional(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: `Validation failed: ${error.message}` });
    }

    const normalized = normalizeMsisdn(value.to);
    if (!normalized.ok) {
      await AuditService.log({
        req,
        actionType: 'SYSTEM',
        tableName: 'whatsapp_messages',
        description: `Validation gagal: ${normalized.error}`,
        newValues: { input: value.to, ...value },
      });
      return res.status(400).json({ success: false, message: `Invalid phone: ${normalized.error}` });
    }

    const queued = await enqueueWhatsAppMessage({
      to: normalized.digits!,
      message: value.message,
      correlation_id: value.correlation_id,
    });

    const auditDesc = value.freelancer_name && value.task_title
      ? `Agihan Tugasan: Mesej WhatsApp ke ${value.freelancer_name} (ID: ${value.freelancer_id}) untuk Tugasan: ${value.task_title} (ID: ${value.task_id}) melalui ${activeProvider}`
      : `Permintaan penghantaran WhatsApp dimasukkan ke queue melalui ${activeProvider}`;

    await AuditService.log({
      req,
      actionType: 'SYSTEM',
      tableName: 'whatsapp_messages',
      recordId: queued.id,
      newValues: {
        status: 'queued',
        to: queued.to,
        provider: activeProvider,
        freelancer_id: value.freelancer_id,
        freelancer_name: value.freelancer_name,
        task_id: value.task_id,
        task_title: value.task_title,
      },
      description: auditDesc,
    });

    return res.json({
      success: true,
      data: { queuedId: queued.id, status: queued.status, provider: activeProvider },
      message: 'Permintaan penghantaran dimasukkan ke queue',
    });
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.message || 'Failed to enqueue';
    const fullErrorResponse = error.response?.data || null;

    await AuditService.log({
      req,
      actionType: 'SYSTEM',
      tableName: 'whatsapp_messages',
      description: 'Queue: Gagal memasukkan mesej ke queue',
      newValues: {
        error: errorMsg,
        full_error_response: fullErrorResponse,
        to: req.body?.to,
      },
    });

    console.error('WhatsApp enqueue error:', error.response?.data || error.message);
    return res.status(500).json({ success: false, message: errorMsg });
  }
});

router.post('/send-template', authenticateToken, requirePermission('settings:manage:api'), async (_req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Template sending not yet implemented' });
});

router.post('/config', authenticateToken, requirePermission('settings:manage:api'), async (req: Request, res: Response) => {
  try {
    const schema = Joi.object({
      apiKey: Joi.string().trim().required(),
      deviceId: Joi.string().trim().required(),
      apiUrl: Joi.string().uri({ scheme: ['http', 'https'] }).optional().allow(''),
      isActive: Joi.boolean().optional(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: `Validation failed: ${error.message}` });
    }

    const saved = await saveWasapmaticConfigToDB(value.apiKey, value.deviceId, value.apiUrl || undefined);
    if (!saved) {
      return res.status(500).json({ success: false, message: 'Failed to save configuration to database' });
    }

    WASAPMATIC_API_KEY = value.apiKey;
    WASAPMATIC_DEVICE_ID = value.deviceId;
    if (value.apiUrl) WASAPMATIC_API_URL = value.apiUrl;

    if (value.isActive === true) {
      await setActiveProvider('wasapmatic');
    } else if (value.isActive === false && (await getActiveProviderFromDB()) === 'wasapmatic') {
      await setActiveProvider(null);
    }

    try {
      const response = await axios.get(`${value.apiUrl || WASAPMATIC_API_URL}/get/credits`, {
        params: { secret: value.apiKey },
      });

      return res.json({
        success: true,
        message: 'Configuration saved and tested successfully',
        data: { ...(response.data || {}), activeProvider: await getActiveProviderFromDB() },
      });
    } catch (testError: any) {
      return res.json({
        success: true,
        message: `Configuration saved. Test connection failed: ${testError.response?.data?.message || testError.message}`,
        data: { activeProvider: await getActiveProviderFromDB() },
      });
    }
  } catch (error: any) {
    console.error('Wasapmatic config error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update configuration' });
  }
});

router.post('/marz/config', authenticateToken, requirePermission('settings:manage:api'), async (req: Request, res: Response) => {
  try {
    const schema = Joi.object({
      apiSecret: Joi.string().trim().required(),
      accountId: Joi.string().trim().required(),
      isActive: Joi.boolean().optional(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: `Validation failed: ${error.message}` });
    }

    const saved = await saveMarzConfigToDB(value.apiSecret, value.accountId);
    if (!saved) {
      return res.status(500).json({ success: false, message: 'Failed to save Marz Wasap configuration to database' });
    }

    MARZ_WASAP_API_SECRET = value.apiSecret;
    MARZ_WASAP_ACCOUNT_ID = value.accountId;
    MARZ_WASAP_API_URL = DEFAULT_MARZ_API_URL;

    if (value.isActive === true) {
      await setActiveProvider('marz');
    } else if (value.isActive === false && (await getActiveProviderFromDB()) === 'marz') {
      await setActiveProvider(null);
    }

    try {
      const response = await axios.get(`${MARZ_WASAP_API_URL}/get/credits`, {
        params: { secret: value.apiSecret },
      });

      return res.json({
        success: true,
        message: 'Marz Wasap configuration saved and tested successfully',
        data: { ...(response.data || {}), activeProvider: await getActiveProviderFromDB() },
      });
    } catch (testError: any) {
      return res.json({
        success: true,
        message: `Marz Wasap configuration saved. Test connection failed: ${testError.response?.data?.message || testError.message}`,
        data: { activeProvider: await getActiveProviderFromDB() },
      });
    }
  } catch (error: any) {
    console.error('Marz Wasap config error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update Marz Wasap configuration' });
  }
});

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    const repo = AppDataSource.getRepository((await import('../models/WhatsAppMessage.ts')).WhatsAppMessage);
    const providerId = payload.message_id || payload.id || payload.provider_message_id;
    const status = payload.status || payload.event || '';

    if (providerId) {
      const msg = await repo.findOne({ where: { provider_message_id: providerId } });
      if (msg) {
        await AuditService.log({
          req,
          actionType: 'SYSTEM',
          tableName: 'whatsapp_messages',
          recordId: msg.id,
          newValues: {
            provider_status: status,
            provider_payload: payload,
            previous_status: msg.status,
          },
          description: `Webhook: status update -> ${status}`,
        });

        if (status === 'delivered') {
          msg.status = 'delivered';
          msg.delivered_at = new Date();
          await repo.save(msg);
        } else if (status === 'failed') {
          msg.status = 'failed';
          msg.last_error = payload.error || payload.reason || 'failed by provider';
          await repo.save(msg);
        }
      } else {
        await AuditService.log({
          req,
          actionType: 'SYSTEM',
          tableName: 'whatsapp_messages',
          description: `Webhook: Message not found for provider_id ${providerId}`,
          newValues: { payload },
        });
      }
    } else {
      await AuditService.log({
        req,
        actionType: 'SYSTEM',
        tableName: 'whatsapp_messages',
        description: 'Webhook: No provider_message_id found',
        newValues: { payload },
      });
    }

    return res.status(200).json({ success: true });
  } catch {
    return res.status(200).json({ success: true });
  }
});

export default router;
