import axios from 'axios';

interface IlmuMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface IlmuCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: IlmuMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class IlmuService {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.ILMU_API_KEY || '';
    this.baseUrl = process.env.ILMU_API_URL || 'https://api.ilmu.ai/v1';
    this.defaultModel = process.env.ILMU_MODEL || 'nemo-super';
  }

  /**
   * Check if ILMU AI is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Update API key dynamically
   */
  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Update base URL dynamically
   */
  setBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Update default model dynamically
   */
  setDefaultModel(model: string) {
    const normalized = String(model || '').trim();
    if (normalized) {
      this.defaultModel = normalized;
    }
  }

  /**
   * Get default model name
   */
  getDefaultModel(): string {
    return this.defaultModel;
  }

  /**
   * Test connection to ILMU AI
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'ILMU API key not configured'
      };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.defaultModel,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        message: `Connected successfully. Model: ${response.data.model}`
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message || 'Connection failed'
      };
    }
  }

  /**
   * List available models from ILMU AI
   * GET /v1/models
   */
  async listModels(): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('ILMU API key not configured');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/models`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('ILMU list models error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send a chat completion request to ILMU AI
   * POST /v1/chat/completions
   */
  async chatCompletion(
    messages: IlmuMessage[],
    model?: string
  ): Promise<IlmuCompletionResponse> {
    if (!this.isConfigured()) {
      throw new Error('ILMU API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: model || this.defaultModel,
          messages,
          temperature: 0.7,
          max_tokens: 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('ILMU completion error:', error.response?.data || error.message);
      throw error;
    }
  }
}

export const ilmuService = new IlmuService();
