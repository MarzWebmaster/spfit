import axios from 'axios';

interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiGenerateRequest {
  contents: GeminiMessage[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
  };
}

interface GeminiGenerateResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
    index: number;
  }>;
  promptFeedback?: any;
}

class GeminiService {
  private apiKey: string;
  private apiUrl: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.apiUrl = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta';
    this.defaultModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  }

  /**
   * Check if Gemini is configured
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

  setDefaultModel(model: string) {
    const normalized = String(model || '').trim().replace(/^models\//, '');
    if (normalized) {
      this.defaultModel = normalized;
    }
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  /**
   * Generate content using Gemini
   */
  async generateContent(request: GeminiGenerateRequest, model?: string): Promise<GeminiGenerateResponse> {
    if (!this.isConfigured()) {
      throw new Error('Gemini API key not configured');
    }

    const modelName = model || this.defaultModel;
    // Remove 'models/' prefix if present, we'll add it in the URL
    const cleanModelName = modelName.replace(/^models\//, '');

    try {
      const response = await axios.post(
        `${this.apiUrl}/models/${cleanModelName}:generateContent?key=${this.apiKey}`,
        request,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Gemini generation error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Simple text generation
   */
  async generate(prompt: string, model?: string): Promise<string> {
    const response = await this.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000
      }
    }, model);

    if (response.candidates && response.candidates.length > 0) {
      return response.candidates[0].content.parts[0].text;
    }

    throw new Error('No response generated');
  }

  /**
   * Test connection to Gemini
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Gemini API key not configured'
      };
    }

    try {
      const response = await this.generate(
        'Say "Connection successful" if you receive this message.',
        this.defaultModel
      );

      return {
        success: true,
        message: `Connected successfully. Response: ${response.substring(0, 100)}`
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message || 'Connection failed'
      };
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const response = await axios.get(
        `${this.apiUrl}/models?key=${this.apiKey}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Gemini list models error:', error.response?.data || error.message);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
