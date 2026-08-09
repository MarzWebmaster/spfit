import axios from 'axios';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAICompletionRequest {
  model?: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface OpenAICompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAIMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class OpenAIService {
  private apiKey: string;
  private apiUrl: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.apiUrl = process.env.OPENAI_API_URL || 'https://api.openai.com/v1';
    this.defaultModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  /**
   * Check if OpenAI is configured
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
   * Get available models
   */
  async getModels(): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await axios.get(`${this.apiUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error: any) {
      console.error('OpenAI get models error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send chat completion request
   */
  async chatCompletion(request: OpenAICompletionRequest): Promise<OpenAICompletionResponse> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.apiUrl}/chat/completions`,
        {
          model: request.model || this.defaultModel,
          messages: request.messages,
          temperature: request.temperature || 0.7,
          max_tokens: request.max_tokens || 1000
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
      console.error('OpenAI completion error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Test connection to OpenAI
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'OpenAI API key not configured'
      };
    }

    try {
      const response = await this.chatCompletion({
        messages: [
          { role: 'user', content: 'Say "Connection successful" if you receive this message.' }
        ],
        max_tokens: 50
      });

      return {
        success: true,
        message: `Connected successfully. Model: ${response.model}`
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message || 'Connection failed'
      };
    }
  }
}

export const openaiService = new OpenAIService();
