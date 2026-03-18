import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AIStudioConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface ChatResponse {
  content: string;
  usage?: {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
  };
  model: string;
  timestamp: Date;
}

export class AIStudioClient {
  private genAI: GoogleGenerativeAI;
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(config: AIStudioConfig) {
    // Validate API key
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new Error('API key is required');
    }

    // Basic API key format validation (Google AI Studio format)
    if (!config.apiKey.startsWith('AIza') || config.apiKey.length < 39) {
      throw new Error('Invalid API key format. Expected Google AI Studio API key.');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = 'https://generativelanguage.googleapis.com';
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.model = config.model || 'gemini-1.5-flash';
    this.temperature = config.temperature || 0.7;
    this.maxTokens = config.maxTokens || 2048;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (attempt < this.retryAttempts && this.isRetryableError(error)) {
        console.log(`Retry attempt ${attempt + 1}/${this.retryAttempts} after ${this.retryDelay}ms`);
        await this.delay(this.retryDelay);
        return this.retryOperation(operation, attempt + 1);
      }
      throw error;
    }
  }

  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message || error.toString();
    const retryableErrors = [
      'visibility check was unavailable',
      'service unavailable',
      'internal server error',
      'bad gateway',
      'gateway timeout',
      'timeout',
      'network error',
      'econnreset',
      'econnrefused'
    ];
    
    return retryableErrors.some(retryableError => 
      errorMessage.toLowerCase().includes(retryableError.toLowerCase())
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async chat(messages: ChatMessage[], systemPrompt?: string): Promise<ChatResponse> {
    return this.retryOperation(async () => {
      let response;
      try {
        response = await fetch(`${this.baseUrl}/v1beta/models/gemini-pro:generateContent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            contents: messages.map(msg => ({
              role: msg.role === 'user' ? 'user' : 'model',
              parts: [{ text: msg.content }]
            })),
            systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
            generationConfig: {
              temperature: this.temperature,
              maxOutputTokens: this.maxTokens,
              topP: 0.8,
              topK: 40
            }
          })
        });
      } catch (error) {
        throw new Error(`AI Studio API Error: ${error instanceof Error ? error.message : String(error)}`);
      }

      try {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.candidates || data.candidates.length === 0) {
          throw new Error('No response generated from AI Studio');
        }

        const candidate = data.candidates[0];
        if (candidate.finishReason === 'SAFETY') {
          throw new Error('Response blocked by safety filters');
        }

        const content = candidate.content?.parts?.[0]?.text || '';
        
        return {
          content,
          usage: data.usageMetadata ? {
            promptTokens: data.usageMetadata.promptTokenCount || 0,
            responseTokens: data.usageMetadata.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata.totalTokenCount || 0
          } : undefined,
          model: this.model,
          timestamp: new Date()
        };

      } catch (error) {
        console.error('AI Studio API Error:', error);
        
        // Provide more specific error information
        if (error instanceof Error) {
          if (error.message.includes('API key not valid') || error.message.includes('authentication')) {
            throw new Error('Invalid API key. Please check your Google AI Studio API key.');
          }
          if (error.message.includes('quota') || error.message.includes('rate limit')) {
            throw new Error('API quota exceeded. Please check your Google AI Studio usage limits.');
          }
          if (error.message.includes('visibility check was unavailable')) {
            throw new Error('Service temporarily unavailable. Please try again in a few moments.');
          }
        }
        
        throw new Error(`AI Studio API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  async generateText(prompt: string, systemPrompt?: string): Promise<ChatResponse> {
    const messages: ChatMessage[] = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      { role: 'user', content: prompt }
    ];
    
    return this.chat(messages);
  }

  // Test the API connection with a simple, reliable test
  async testConnection(): Promise<boolean> {
    try {
      // Use a very simple test that's less likely to fail
      const model = this.genAI.getGenerativeModel({
        model: this.model,
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 50,
        },
      });

      const result = await model.generateContent('Say "Hello"');
      const response = await result.response;
      const text = response.text();
      
      return !!text && text.length > 0;
    } catch (error) {
      console.error('Connection test failed:', error);
      
      // Log specific error details for debugging
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      
      return false;
    }
  }

  // Get available models
  async getAvailableModels(): Promise<string[]> {
    // For Google AI Studio, we'll return the commonly available models
    return [
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-1.0-pro',
      'gemini-1.0-pro-vision'
    ];
  }

  // Validate API key format
  static validateApiKey(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') return false;
    
    // Google AI API keys are typically 39 characters and start with "AI"
    const trimmedKey = apiKey.trim();
    return trimmedKey.length >= 20 && trimmedKey.length <= 100;
  }
}

// Utility function to estimate cost (Google AI Studio is free, but we'll track usage)
export function estimateCost(usage: { promptTokens: number; responseTokens: number }): number {
  // Google AI Studio is currently free, but we'll track for future reference
  const inputCostPer1K = 0; // Free
  const outputCostPer1K = 0; // Free
  
  const inputCost = (usage.promptTokens / 1000) * inputCostPer1K;
  const outputCost = (usage.responseTokens / 1000) * outputCostPer1K;
  
  return inputCost + outputCost;
} 