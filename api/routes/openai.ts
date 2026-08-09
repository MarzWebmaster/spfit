import { Router, Request, Response } from 'express';
import { openaiService } from '../services/openaiService';
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
      where: { setting_key: 'openai_api_key' }
    });
    return setting?.setting_value || null;
  } catch (error) {
    console.error('Error fetching OpenAI API key from DB:', error);
    return null;
  }
};

// Helper to save API key to database (encrypted in production)
const saveApiKeyToDB = async (apiKey: string): Promise<boolean> => {
  try {
    if (!AppDataSource.isInitialized) {
      return false;
    }
    const settingsRepository = AppDataSource.getRepository(SystemSettings);
    let setting = await settingsRepository.findOne({
      where: { setting_key: 'openai_api_key' }
    });

    if (setting) {
      setting.setting_value = apiKey;
      setting.is_active = true;
      await settingsRepository.save(setting);
    } else {
      const newSetting = settingsRepository.create({
        setting_key: 'openai_api_key',
        setting_value: apiKey,
        description: 'OpenAI API Key',
        data_type: 'string',
        is_active: true
      });
      await settingsRepository.save(newSetting);
    }
    return true;
  } catch (error) {
    console.error('Error saving OpenAI API key to DB:', error);
    return false;
  }
};

// Initialize API key from database - deferred initialization
export const initializeOpenAIConfig = async () => {
  try {
    const apiKey = await getApiKeyFromDB();
    if (apiKey) {
      openaiService.setApiKey(apiKey);
      console.log('✅ OpenAI API key loaded from database');
    }
  } catch (error) {
    console.error('❌ Failed to initialize OpenAI config:', error);
  }
};

// Test OpenAI connection
router.post('/test', async (req: Request, res: Response) => {
  try {
    const result = await openaiService.testConnection();
    res.json(result);
  } catch (error: any) {
    console.error('OpenAI test error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to test OpenAI connection'
    });
  }
});

// Get available models
router.get('/models', async (req: Request, res: Response) => {
  try {
    const models = await openaiService.getModels();
    res.json({
      success: true,
      data: models
    });
  } catch (error: any) {
    console.error('OpenAI models error:', error);
    res.status(500).json({
      success: false,
      message: error.response?.data?.error?.message || error.message || 'Failed to get models'
    });
  }
});

// Chat completion
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { messages, model, temperature, max_tokens } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Messages array is required'
      });
    }

    const response = await openaiService.chatCompletion({
      messages,
      model,
      temperature,
      max_tokens
    });

    res.json({
      success: true,
      data: response
    });
  } catch (error: any) {
    console.error('OpenAI chat error:', error);
    res.status(500).json({
      success: false,
      message: error.response?.data?.error?.message || error.message || 'Failed to generate chat completion'
    });
  }
});

// Update API key
router.post('/config', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'API key is required'
      });
    }

    // Save to database first
    const saved = await saveApiKeyToDB(apiKey);
    if (!saved) {
      return res.status(500).json({
        success: false,
        message: 'Failed to save API key to database'
      });
    }

    // Update in-memory service
    openaiService.setApiKey(apiKey);

    // Test the new key
    const testResult = await openaiService.testConnection();

    res.json({
      success: testResult.success,
      message: testResult.success ? 'API key updated and saved successfully' : testResult.message
    });
  } catch (error: any) {
    console.error('OpenAI config error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update API key'
    });
  }
});

export default router;
