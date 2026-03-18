import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIStudioClient } from '@/lib/ai-studio';

// Mock fetch globally
global.fetch = vi.fn();

describe('AIStudioClient', () => {
  let client: AIStudioClient;
  const mockApiKey = 'AIzaSyC1234567890abcdefghijklmnopqrstuvwxyz';

  beforeEach(() => {
    client = new AIStudioClient({ apiKey: mockApiKey });
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with valid API key', () => {
      expect(client).toBeInstanceOf(AIStudioClient);
    });

    it('should throw error for empty API key', () => {
      expect(() => new AIStudioClient({ apiKey: '' })).toThrow('API key is required');
    });

    it('should throw error for invalid API key format', () => {
      expect(() => new AIStudioClient({ apiKey: 'invalid-key' })).toThrow('Invalid API key format');
    });
  });

  describe('chat method', () => {
    it('should make successful API call', async () => {
      const mockResponse = {
        candidates: [{
          content: { parts: [{ text: 'Hello! How can I help you?' }] },
          finishReason: 'STOP'
        }],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15
        }
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const result = await client.chat(messages);

      expect(result.content).toBe('Hello! How can I help you?');
      expect(result.usage).toEqual({
        promptTokens: 10,
        responseTokens: 5,
        totalTokens: 15
      });
    });

    it('should handle API errors', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: { message: 'API key not valid' } })
      });

      const messages = [{ role: 'user' as const, content: 'Hello' }];
      
      await expect(client.chat(messages)).rejects.toThrow('Invalid API key');
    });

    it('should handle network errors gracefully', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const client = new AIStudioClient({ 
        apiKey: 'AIzaSyCtest_api_key_for_testing_purposes_only_123456789' 
      });
      
      const messages = [{ role: 'user' as const, content: 'Hello' }];
      await expect(client.chat(messages)).rejects.toThrow('AI Studio API Error: Network error');
      
      global.fetch = originalFetch;
    });

    it('should validate API key before making request', async () => {
      expect(() => new AIStudioClient({ apiKey: 'invalid' })).toThrow('Invalid API key format');
    });

    it('should handle safety filter blocks', async () => {
      const mockResponse = {
        candidates: [{
          content: { parts: [{ text: '' }] },
          finishReason: 'SAFETY'
        }]
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const messages = [{ role: 'user' as const, content: 'Hello' }];
      
      await expect(client.chat(messages)).rejects.toThrow('Response blocked by safety filters');
    });

    it('should handle empty response', async () => {
      const mockResponse = {
        candidates: []
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const messages = [{ role: 'user' as const, content: 'Hello' }];
      
      await expect(client.chat(messages)).rejects.toThrow('No response generated from AI Studio');
    });
  });

  describe('retry mechanism', () => {
    it('should retry on retryable errors', async () => {
      const mockResponse = {
        candidates: [{
          content: { parts: [{ text: 'Success after retry' }] },
          finishReason: 'STOP'
        }]
      };

      // First call fails, second succeeds
      (fetch as any)
        .mockRejectedValueOnce(new Error('service unavailable'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        });

      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const result = await client.chat(messages);

      expect(result.content).toBe('Success after retry');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Invalid API key'));

      const messages = [{ role: 'user' as const, content: 'Hello' }];
      
      await expect(client.chat(messages)).rejects.toThrow('Invalid API key');
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('configuration', () => {
    it('should use custom configuration', () => {
      const customClient = new AIStudioClient({
        apiKey: mockApiKey,
        temperature: 0.5,
        maxTokens: 1000,
        retryAttempts: 5,
        retryDelay: 2000
      });

      expect(customClient).toBeInstanceOf(AIStudioClient);
    });

    it('should use default configuration when not provided', () => {
      expect(client).toBeInstanceOf(AIStudioClient);
    });
  });
}); 