import { Router, Request, Response } from 'express';
import { ilmuService } from '../services/ilmuService';
import { AppDataSource } from '../config/database.ts';
import { SystemSettings } from '../models/SystemSettings.ts';
import { authenticateToken, requirePermission } from '../middleware/auth.ts';

const router = Router();

router.use(authenticateToken);
router.use(requirePermission('settings:manage:api'));

const DEFAULT_MODEL = 'nemo-super';
const DEFAULT_BASE_URL = 'https://api.ilmu.ai/v1';

const getApiKeyFromDB = async (): Promise<string | null> => {
  try {
    if (!AppDataSource.isInitialized) return null;
    const repo = AppDataSource.getRepository(SystemSettings);
    const s = await repo.findOne({ where: { setting_key: 'ilmu_api_key' } });
    return s?.setting_value || null;
  } catch { return null; }
};

const getModelFromDB = async (): Promise<string | null> => {
  try {
    if (!AppDataSource.isInitialized) return null;
    const repo = AppDataSource.getRepository(SystemSettings);
    const s = await repo.findOne({ where: { setting_key: 'ilmu_model' } });
    return s?.setting_value || null;
  } catch { return null; }
};

const getBaseUrlFromDB = async (): Promise<string | null> => {
  try {
    if (!AppDataSource.isInitialized) return null;
    const repo = AppDataSource.getRepository(SystemSettings);
    const s = await repo.findOne({ where: { setting_key: 'ilmu_base_url' } });
    return s?.setting_value || null;
  } catch { return null; }
};

const saveSetting = async (key: string, value: string, desc: string): Promise<boolean> => {
  try {
    if (!AppDataSource.isInitialized) return false;
    const repo = AppDataSource.getRepository(SystemSettings);
    let setting = await repo.findOne({ where: { setting_key: key } });
    if (setting) {
      setting.setting_value = value;
      setting.is_active = true;
      await repo.save(setting);
    } else {
      const ns = repo.create({
        setting_key: key,
        setting_value: value,
        description: desc,
        data_type: 'string',
        is_active: true
      });
      await repo.save(ns);
    }
    return true;
  } catch { return false; }
};

export const initializeIlmuConfig = async () => {
  try {
    const [apiKey, model, baseUrl] = await Promise.all([getApiKeyFromDB(), getModelFromDB(), getBaseUrlFromDB()]);
    if (apiKey) { ilmuService.setApiKey(apiKey); }
    if (model) { ilmuService.setDefaultModel(model); }
    if (baseUrl) { ilmuService.setBaseUrl(baseUrl); }
    if (apiKey) console.log('✅ ILMU AI API key loaded from database');
  } catch (error) {
    console.error('Failed to initialize ILMU AI config:', error);
  }
};

router.get('/config', async (_req: Request, res: Response) => {
  try {
    const [model, baseUrl] = await Promise.all([getModelFromDB(), getBaseUrlFromDB()]);
    res.json({
      success: true,
      data: {
        model: model || ilmuService.getDefaultModel(),
        base_url: baseUrl || DEFAULT_BASE_URL
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load ILMU config' });
  }
});

router.post('/test', async (_req: Request, res: Response) => {
  try {
    const result = await ilmuService.testConnection();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to test ILMU connection' });
  }
});

router.get('/models', async (_req: Request, res: Response) => {
  try {
    const models = await ilmuService.listModels();
    res.json({ success: true, data: models });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.response?.data?.error?.message || err.message || 'Failed to get models' });
  }
});

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { messages, model } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, message: 'Messages array is required' });
    }
    const response = await ilmuService.chatCompletion(messages, model);
    res.json({ success: true, data: response });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.response?.data?.error?.message || err.message || 'Failed to chat' });
  }
});

router.post('/config', async (req: Request, res: Response) => {
  try {
    const { apiKey, model, baseUrl } = req.body;
    const hasKey = Boolean(String(apiKey || '').trim());
    const hasModel = Boolean(String(model || '').trim());
    const hasBaseUrl = Boolean(String(baseUrl || '').trim());

    if (!hasKey && !hasModel && !hasBaseUrl) {
      return res.status(400).json({ success: false, message: 'API key, model atau base URL diperlukan' });
    }

    if (hasKey) {
      const saved = await saveSetting('ilmu_api_key', String(apiKey).trim(), 'ILMU AI API Key');
      if (!saved) return res.status(500).json({ success: false, message: 'Failed to save API key' });
      ilmuService.setApiKey(String(apiKey).trim());
    }

    if (hasModel) {
      const nm = String(model).trim();
      await saveSetting('ilmu_model', nm, 'ILMU AI default model');
      ilmuService.setDefaultModel(nm);
    }

    if (hasBaseUrl) {
      const ub = String(baseUrl).trim().replace(/\/$/, '');
      await saveSetting('ilmu_base_url', ub, 'ILMU AI base URL');
      ilmuService.setBaseUrl(ub);
    }

    const testResult = hasKey ? await ilmuService.testConnection() : { success: true, message: 'Config updated' };

    res.json({
      success: testResult.success,
      message: testResult.success ? 'Konfigurasi ILMU AI berjaya disimpan' : testResult.message
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update config' });
  }
});

export default router;
