import { Router, Request, Response } from 'express';
import { geminiService } from '../services/geminiService';
import { AppDataSource } from '../config/database.ts';
import { SystemSettings } from '../models/SystemSettings.ts';
import { authenticateToken, requirePermission } from '../middleware/auth.ts';

const router = Router();

router.use(authenticateToken);
router.use(requirePermission('settings:manage:api'));

// Helper to get API key from database
const getApiKeyFromDB = async (): Promise<string | null> => {
  try {
    if (!AppDataSource.isInitialized) {
      return null;
    }
    const settingsRepository = AppDataSource.getRepository(SystemSettings);
    const setting = await settingsRepository.findOne({
      where: { setting_key: 'gemini_api_key' }
    });
    return setting?.setting_value || null;
  } catch (error) {
    console.error('Error fetching Gemini API key from DB:', error);
    return null;
  }
};

const getModelFromDB = async (): Promise<string | null> => {
  try {
    if (!AppDataSource.isInitialized) {
      return null;
    }
    const settingsRepository = AppDataSource.getRepository(SystemSettings);
    const setting = await settingsRepository.findOne({
      where: { setting_key: 'gemini_model' }
    });
    return setting?.setting_value || null;
  } catch (error) {
    console.error('Error fetching Gemini model from DB:', error);
    return null;
  }
};

// Helper to save API key to database
const saveApiKeyToDB = async (apiKey: string): Promise<boolean> => {
  try {
    if (!AppDataSource.isInitialized) {
      return false;
    }
    const settingsRepository = AppDataSource.getRepository(SystemSettings);
    let setting = await settingsRepository.findOne({
      where: { setting_key: 'gemini_api_key' }
    });

    if (setting) {
      setting.setting_value = apiKey;
      setting.is_active = true;
      await settingsRepository.save(setting);
    } else {
      const newSetting = settingsRepository.create({
        setting_key: 'gemini_api_key',
        setting_value: apiKey,
        description: 'Google Gemini API Key',
        data_type: 'string',
        is_active: true
      });
      await settingsRepository.save(newSetting);
    }
    return true;
  } catch (error) {
    console.error('Error saving Gemini API key to DB:', error);
    return false;
  }
};

const saveModelToDB = async (model: string): Promise<boolean> => {
  try {
    if (!AppDataSource.isInitialized) {
      return false;
    }

    const normalized = String(model || '').trim().replace(/^models\//, '');
    if (!normalized) {
      return false;
    }

    const settingsRepository = AppDataSource.getRepository(SystemSettings);
    let setting = await settingsRepository.findOne({
      where: { setting_key: 'gemini_model' }
    });

    if (setting) {
      setting.setting_value = normalized;
      setting.is_active = true;
      await settingsRepository.save(setting);
    } else {
      const newSetting = settingsRepository.create({
        setting_key: 'gemini_model',
        setting_value: normalized,
        description: 'Google Gemini default model',
        data_type: 'string',
        is_active: true
      });
      await settingsRepository.save(newSetting);
    }

    return true;
  } catch (error) {
    console.error('Error saving Gemini model to DB:', error);
    return false;
  }
};

// Initialize API key from database - deferred initialization
export const initializeGeminiConfig = async () => {
  try {
    const [apiKey, model] = await Promise.all([getApiKeyFromDB(), getModelFromDB()]);
    if (apiKey) {
      geminiService.setApiKey(apiKey);
      console.log('✅ Gemini API key loaded from database');
    }
    if (model) {
      geminiService.setDefaultModel(model);
      console.log(`✅ Gemini model loaded from database: ${model}`);
    }
  } catch (error) {
    console.error('❌ Failed to initialize Gemini config:', error);
  }
};

// Get current Gemini config (safe, no API key exposed)
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const model = await getModelFromDB();
    res.json({
      success: true,
      data: {
        model: model || geminiService.getDefaultModel()
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load Gemini config'
    });
  }
});

// Test Gemini connection
router.post('/test', async (req: Request, res: Response) => {
  try {
    const result = await geminiService.testConnection();
    res.json(result);
  } catch (error: any) {
    console.error('Gemini test error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to test Gemini connection'
    });
  }
});

// Get available models
router.get('/models', async (req: Request, res: Response) => {
  try {
    const models = await geminiService.listModels();
    res.json({
      success: true,
      data: models
    });
  } catch (error: any) {
    console.error('Gemini models error:', error);
    res.status(500).json({
      success: false,
      message: error.response?.data?.error?.message || error.message || 'Failed to get models'
    });
  }
});

// Generate content
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { prompt, model } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required'
      });
    }

    const response = await geminiService.generate(prompt, model);

    res.json({
      success: true,
      data: { text: response }
    });
  } catch (error: any) {
    console.error('Gemini generate error:', error);
    res.status(500).json({
      success: false,
      message: error.response?.data?.error?.message || error.message || 'Failed to generate content'
    });
  }
});

// Advanced generation with full control
router.post('/generate-content', async (req: Request, res: Response) => {
  try {
    const { contents, generationConfig, model } = req.body;

    if (!contents || !Array.isArray(contents) || contents.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Contents array is required'
      });
    }

    const response = await geminiService.generateContent(
      { contents, generationConfig },
      model
    );

    res.json({
      success: true,
      data: response
    });
  } catch (error: any) {
    console.error('Gemini generate content error:', error);
    res.status(500).json({
      success: false,
      message: error.response?.data?.error?.message || error.message || 'Failed to generate content'
    });
  }
});

// Update API key
router.post('/config', async (req: Request, res: Response) => {
  try {
    const { apiKey, model } = req.body;
    const hasApiKey = Boolean(String(apiKey || '').trim());
    const hasModel = Boolean(String(model || '').trim());

    if (!hasApiKey && !hasModel) {
      return res.status(400).json({
        success: false,
        message: 'API key atau model diperlukan'
      });
    }

    if (hasApiKey) {
      const saved = await saveApiKeyToDB(String(apiKey).trim());
      if (!saved) {
        return res.status(500).json({
          success: false,
          message: 'Failed to save API key to database'
        });
      }

      geminiService.setApiKey(String(apiKey).trim());
    }

    if (hasModel) {
      const normalizedModel = String(model).trim().replace(/^models\//, '');
      const modelSaved = await saveModelToDB(normalizedModel);
      if (!modelSaved) {
        return res.status(500).json({
          success: false,
          message: 'Failed to save model to database'
        });
      }
      geminiService.setDefaultModel(normalizedModel);
    }

    const testResult = hasApiKey ? await geminiService.testConnection() : { success: true, message: 'Model updated' };

    res.json({
      success: testResult.success,
      message: testResult.success ? 'Konfigurasi Gemini berjaya disimpan' : testResult.message
    });
  } catch (error: any) {
    console.error('Gemini config error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update API key'
    });
  }
});

export default router;
