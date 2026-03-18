import axios, { AxiosRequestConfig } from 'axios';

export interface CustomAPIConfig {
  id: string;
  name: string;
  displayName: string; // User-friendly display name
  description: string;
  type: 'ai-agent' | 'data-api' | 'service-api' | 'webhook';
  category: string;
  baseUrl: string;
  authentication: {
    type: 'none' | 'api-key' | 'bearer-token' | 'basic-auth' | 'oauth2' | 'custom';
    config: Record<string, any>;
  };
  endpoints: CustomAPIEndpoint[];
  headers?: Record<string, string>;
  timeout?: number;
  rateLimit?: {
    requests: number;
    period: 'second' | 'minute' | 'hour' | 'day';
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[]; // For categorization and search
  version?: string; // API version
  author?: string; // Creator of the API/agent
}

export interface CustomAPIEndpoint {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  parameters?: CustomAPIParameter[];
  requestBody?: CustomAPIRequestBody;
  responseMapping?: Record<string, string>;
  isDefault?: boolean;
  queryParams?: Record<string, any>;
}

export interface CustomAPIParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  defaultValue?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: any[];
  };
}

export interface CustomAPIRequestBody {
  type: 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw';
  schema: Record<string, any>;
  required?: string[];
}

export interface CustomAPICall {
  id: string;
  apiId: string;
  endpointId: string;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
    params?: Record<string, any>;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    data: any;
    duration: number;
  };
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface CustomAPIAgent extends CustomAPIConfig {
  type: 'ai-agent';
  // Core AI Agent Properties
  personality: string;
  capabilities: string[];
  avatar?: string;
  model?: string;
  
  // Prompt Engineering (Similar to OpenAI Custom GPTs)
  systemPrompt: string;
  conversationStarters: string[]; // Suggested conversation starters
  instructions: string; // Detailed instructions for the agent
  knowledgeBase?: string[]; // Additional knowledge or context
  constraints?: string[]; // What the agent should NOT do
  examples?: {
    input: string;
    output: string;
    explanation?: string;
  }[];
  
  // Behavior Configuration
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  
  // Conversation Style
  communicationStyle: 'formal' | 'casual' | 'professional' | 'friendly' | 'technical' | 'creative';
  expertiseLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  responseLength: 'concise' | 'detailed' | 'comprehensive';
  
  // Specialization
  primaryDomain: string; // Main area of expertise
  secondaryDomains?: string[]; // Additional areas of knowledge
  tools?: string[]; // Available tools or capabilities
  
  // Metadata
  version: string;
  lastTrained?: Date;
  trainingData?: string;
  performanceMetrics?: {
    accuracy?: number;
    responseTime?: number;
    userSatisfaction?: number;
  };
}

class CustomAPIManager {
  private apis: Map<string, CustomAPIConfig> = new Map();
  private calls: CustomAPICall[] = [];
  private readonly STORAGE_KEY = 'evolveai-custom-apis';
  private readonly CALLS_STORAGE_KEY = 'evolveai-api-calls';

  constructor() {
    this.loadAPIs();
    this.loadCalls();
  }

  private loadAPIs(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
          const apis = JSON.parse(saved);
          apis.forEach((api: any) => {
            this.apis.set(api.id, {
              ...api,
              createdAt: new Date(api.createdAt),
              updatedAt: new Date(api.updatedAt)
            });
          });
        }
      }
    } catch (error) {
      console.error('Failed to load custom APIs:', error);
    }
  }

  private saveAPIs(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const apis = Array.from(this.apis.values());
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(apis));
      }
    } catch (error) {
      console.error('Failed to save custom APIs:', error);
    }
  }

  private loadCalls(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem(this.CALLS_STORAGE_KEY);
        if (saved) {
          const calls = JSON.parse(saved);
          this.calls = calls.map((call: any) => ({
            ...call,
            timestamp: new Date(call.timestamp)
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load API calls:', error);
    }
  }

  private saveCalls(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.CALLS_STORAGE_KEY, JSON.stringify(this.calls));
      }
    } catch (error) {
      console.error('Failed to save API calls:', error);
    }
  }

  // Enhanced naming validation
  private validateAgentName(name: string): { isValid: boolean; error?: string } {
    // Check for reserved names
    const reservedNames = [
      'gemini', 'local-llm', 'user', 'system', 'assistant',
      'openai', 'anthropic', 'claude', 'gpt', 'chatgpt',
      'evolveai', 'evolve', 'ai', 'bot', 'agent'
    ];

    if (reservedNames.some(reserved => name.toLowerCase().includes(reserved))) {
      return { 
        isValid: false, 
        error: `Name cannot contain reserved words: ${reservedNames.join(', ')}` 
      };
    }

    // Check for special characters
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
      return { 
        isValid: false, 
        error: 'Name can only contain letters, numbers, spaces, hyphens, and underscores' 
      };
    }

    // Check length
    if (name.length < 3 || name.length > 50) {
      return { 
        isValid: false, 
        error: 'Name must be between 3 and 50 characters' 
      };
    }

    // Check for duplicates
    const existingNames = Array.from(this.apis.values()).map(api => api.name.toLowerCase());
    if (existingNames.includes(name.toLowerCase())) {
      return { 
        isValid: false, 
        error: 'An API with this name already exists' 
      };
    }

    return { isValid: true };
  }

  // Generate display name from internal name
  private generateDisplayName(internalName: string): string {
    return internalName
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  async addAPI(config: Omit<CustomAPIConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomAPIConfig> {
    // Validate name for AI agents
    if (config.type === 'ai-agent') {
      const validation = this.validateAgentName(config.name);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }
    }

    const id = `custom_api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const api: CustomAPIConfig = {
      ...config,
      id,
      displayName: config.displayName || this.generateDisplayName(config.name),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.apis.set(id, api);
    this.saveAPIs();

    // Test the API if it's active
    if (api.isActive) {
      await this.testAPI(id);
    }

    return api;
  }

  async updateAPI(id: string, updates: Partial<CustomAPIConfig>): Promise<CustomAPIConfig> {
    const api = this.apis.get(id);
    if (!api) {
      throw new Error(`API not found: ${id}`);
    }

    // Validate name changes for AI agents
    if (updates.name && api.type === 'ai-agent') {
      const validation = this.validateAgentName(updates.name);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }
    }

    const updatedApi: CustomAPIConfig = {
      ...api,
      ...updates,
      displayName: updates.displayName || (updates.name ? this.generateDisplayName(updates.name) : api.displayName),
      updatedAt: new Date()
    };

    this.apis.set(id, updatedApi);
    this.saveAPIs();

    return updatedApi;
  }

  deleteAPI(id: string): void {
    this.apis.delete(id);
    this.saveAPIs();
  }

  getAPI(id: string): CustomAPIConfig | undefined {
    return this.apis.get(id);
  }

  getAllAPIs(): CustomAPIConfig[] {
    return Array.from(this.apis.values());
  }

  getAPIsByType(type: CustomAPIConfig['type']): CustomAPIConfig[] {
    return this.getAllAPIs().filter(api => api.type === type);
  }

  getActiveAPIs(): CustomAPIConfig[] {
    return this.getAllAPIs().filter(api => api.isActive);
  }

  getAIAgents(): CustomAPIAgent[] {
    return this.getAPIsByType('ai-agent') as CustomAPIAgent[];
  }

  // Search APIs by name, description, or tags
  searchAPIs(query: string): CustomAPIConfig[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllAPIs().filter(api => 
      api.name.toLowerCase().includes(lowerQuery) ||
      api.displayName.toLowerCase().includes(lowerQuery) ||
      api.description.toLowerCase().includes(lowerQuery) ||
      api.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  // Get APIs by category
  getAPIsByCategory(category: string): CustomAPIConfig[] {
    return this.getAllAPIs().filter(api => api.category === category);
  }

  async testAPI(apiId: string): Promise<{ success: boolean; response?: any; error?: string }> {
    const api = this.apis.get(apiId);
    if (!api) {
      throw new Error(`API not found: ${apiId}`);
    }

    const defaultEndpoint = api.endpoints.find(e => e.isDefault) || api.endpoints[0];
    if (!defaultEndpoint) {
      throw new Error(`No default endpoint found for API: ${apiId}`);
    }

    try {
      const response = await this.callAPI(apiId, defaultEndpoint.id, {});
      return { success: true, response: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async callAPI(
    apiId: string, 
    endpointId: string, 
    params: Record<string, any> = {},
    body?: any
  ): Promise<any> {
    const api = this.apis.get(apiId);
    if (!api) {
      throw new Error(`API not found: ${apiId}`);
    }

    const endpoint = api.endpoints.find(e => e.id === endpointId);
    if (!endpoint) {
      throw new Error(`Endpoint not found: ${endpointId}`);
    }

    const startTime = Date.now();
    let response: any;
    let success = false;
    let error: string | undefined;
    let config: any;

    try {
      // Build request configuration
      config = {
        method: endpoint.method,
        url: `${api.baseUrl}${endpoint.path}`,
        timeout: api.timeout || 30000,
        headers: {
          'Content-Type': 'application/json',
          ...api.headers
        }
      };

      // Add authentication
      if (api.authentication.type === 'bearer-token') {
        config.headers.Authorization = `Bearer ${api.authentication.config.token}`;
      } else if (api.authentication.type === 'api-key') {
        config.headers[api.authentication.config.headerName || 'X-API-Key'] = api.authentication.config.apiKey;
      }

      // Add request body for POST/PUT/PATCH requests
      if (['POST', 'PUT', 'PATCH'].includes(endpoint.method) && endpoint.requestBody) {
        if (endpoint.requestBody.type === 'json') {
          config.data = endpoint.requestBody.schema;
        } else if (endpoint.requestBody.type === 'form-data') {
          const formData = new FormData();
          Object.entries(endpoint.requestBody.schema).forEach(([key, value]) => {
            formData.append(key, value as string);
          });
          config.data = formData;
          delete config.headers['Content-Type']; // Let browser set content-type for FormData
        }
      }

      // Add query parameters
      if (endpoint.queryParams) {
        config.params = endpoint.queryParams;
      }

      // Make the request
      response = await axios(config);
      success = true;

    } catch (err: any) {
      error = err.response?.data?.message || err.message || 'Unknown error';
      success = false;
    } finally {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Log the API call
      const call: CustomAPICall = {
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        apiId: api.id,
        endpointId: endpoint.id,
        request: {
          method: endpoint.method,
          url: `${api.baseUrl}${endpoint.path}`,
          headers: config?.headers || {},
          body: config?.data,
          params: config?.params
        },
        response: {
          status: response?.status || 0,
          headers: response?.headers || {},
          data: response?.data,
          duration
        },
        timestamp: new Date(),
        success,
        error
      };

      this.calls.push(call);
      this.saveCalls();
    }

    if (!success) {
      throw new Error(error || 'API call failed');
    }

    return response?.data;
  }

  private addAuthentication(config: AxiosRequestConfig, auth: CustomAPIConfig['authentication']): void {
    switch (auth.type) {
      case 'api-key':
        config.headers = {
          ...config.headers,
          [auth.config.headerName || 'X-API-Key']: auth.config.apiKey
        };
        break;
      case 'bearer-token':
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${auth.config.token}`
        };
        break;
      case 'basic-auth':
        config.auth = {
          username: auth.config.username,
          password: auth.config.password
        };
        break;
      case 'oauth2':
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${auth.config.accessToken}`
        };
        break;
      case 'custom':
        config.headers = {
          ...config.headers,
          ...auth.config.headers
        };
        break;
    }
  }

  private applyResponseMapping(data: any, mapping: Record<string, string>): any {
    const result: any = {};
    
    for (const [targetKey, sourcePath] of Object.entries(mapping)) {
      const value = this.getNestedValue(data, sourcePath);
      if (value !== undefined) {
        result[targetKey] = value;
      }
    }
    
    return result;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  async generateAIAgentResponse(agentId: string, message: string, context?: string): Promise<string> {
    const agent = this.apis.get(agentId) as CustomAPIAgent;
    if (!agent || agent.type !== 'ai-agent') {
      throw new Error(`AI Agent not found: ${agentId}`);
    }

    const defaultEndpoint = agent.endpoints.find(e => e.isDefault) || agent.endpoints[0];
    if (!defaultEndpoint) {
      throw new Error(`No default endpoint found for AI Agent: ${agentId}`);
    }

    // Prepare the request body based on the agent's configuration
    const requestBody = this.buildAIRequest(agent, message, context);

    try {
      const response = await this.callAPI(agentId, defaultEndpoint.id, {}, requestBody);
      return this.extractAIResponse(response, agent);
    } catch (error) {
      throw new Error(`Failed to generate AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildAIRequest(agent: CustomAPIAgent, message: string, context?: string): any {
    // Build comprehensive system prompt
    let systemPrompt = agent.systemPrompt;

    // Add personality and style
    systemPrompt += `\n\nPersonality: ${agent.personality}`;
    systemPrompt += `\nCommunication Style: ${agent.communicationStyle}`;
    systemPrompt += `\nExpertise Level: ${agent.expertiseLevel}`;
    systemPrompt += `\nResponse Length: ${agent.responseLength}`;
    systemPrompt += `\nPrimary Domain: ${agent.primaryDomain}`;

    if (agent.secondaryDomains?.length) {
      systemPrompt += `\nSecondary Domains: ${agent.secondaryDomains.join(', ')}`;
    }

    if (agent.capabilities?.length) {
      systemPrompt += `\nCapabilities: ${agent.capabilities.join(', ')}`;
    }

    if (agent.tools?.length) {
      systemPrompt += `\nAvailable Tools: ${agent.tools.join(', ')}`;
    }

    if (agent.instructions) {
      systemPrompt += `\n\nInstructions:\n${agent.instructions}`;
    }

    if (agent.constraints?.length) {
      systemPrompt += `\n\nConstraints:\n${agent.constraints.map(c => `- ${c}`).join('\n')}`;
    }

    if (agent.knowledgeBase?.length) {
      systemPrompt += `\n\nAdditional Knowledge:\n${agent.knowledgeBase.join('\n')}`;
    }

    if (agent.examples?.length) {
      systemPrompt += `\n\nExample Interactions:\n${agent.examples.map(ex => 
        `User: ${ex.input}\nAssistant: ${ex.output}${ex.explanation ? `\nExplanation: ${ex.explanation}` : ''}`
      ).join('\n\n')}`;
    }

    const baseRequest: any = {
      messages: [
        {
          role: 'system',
          content: systemPrompt
        }
      ]
    };

    // Add context if provided
    if (context) {
      baseRequest.messages.push({
        role: 'user',
        content: `Context: ${context}\n\nUser message: ${message}`
      });
    } else {
      baseRequest.messages.push({
        role: 'user',
        content: message
      });
    }

    // Add model-specific parameters
    if (agent.model) {
      baseRequest.model = agent.model;
    }
    if (agent.temperature !== undefined) {
      baseRequest.temperature = agent.temperature;
    }
    if (agent.maxTokens !== undefined) {
      baseRequest.max_tokens = agent.maxTokens;
    }
    if (agent.topP !== undefined) {
      baseRequest.top_p = agent.topP;
    }
    if (agent.frequencyPenalty !== undefined) {
      baseRequest.frequency_penalty = agent.frequencyPenalty;
    }
    if (agent.presencePenalty !== undefined) {
      baseRequest.presence_penalty = agent.presencePenalty;
    }

    return baseRequest;
  }

  private extractAIResponse(data: any, agent: CustomAPIAgent): string {
    // Try common response patterns
    if (data.choices && data.choices[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    if (data.response) {
      return data.response;
    }
    if (data.text) {
      return data.text;
    }
    if (data.content) {
      return data.content;
    }
    if (typeof data === 'string') {
      return data;
    }

    // If no standard pattern, return the full response
    return JSON.stringify(data);
  }

  getAPICalls(apiId?: string, limit: number = 100): CustomAPICall[] {
    let calls = this.calls;
    
    if (apiId) {
      calls = calls.filter(call => call.apiId === apiId);
    }
    
    return calls
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getAPIAnalytics(apiId: string): {
    totalCalls: number;
    successRate: number;
    averageResponseTime: number;
    errorRate: number;
    lastCall?: Date;
  } {
    const calls = this.getAPICalls(apiId);
    
    if (calls.length === 0) {
      return {
        totalCalls: 0,
        successRate: 0,
        averageResponseTime: 0,
        errorRate: 0
      };
    }

    const successfulCalls = calls.filter(call => call.success);
    const totalResponseTime = calls.reduce((sum, call) => sum + call.response.duration, 0);

    return {
      totalCalls: calls.length,
      successRate: (successfulCalls.length / calls.length) * 100,
      averageResponseTime: totalResponseTime / calls.length,
      errorRate: ((calls.length - successfulCalls.length) / calls.length) * 100,
      lastCall: calls[0]?.timestamp
    };
  }

  clearAPICalls(apiId?: string): void {
    if (apiId) {
      this.calls = this.calls.filter(call => call.apiId !== apiId);
    } else {
      this.calls = [];
    }
    this.saveCalls();
  }

  // Enhanced template generators with better naming and prompts
  generateOpenAITemplate(): CustomAPIAgent {
    return {
      id: '',
      name: 'openai-gpt-assistant',
      displayName: 'OpenAI GPT Assistant',
      description: 'Advanced AI assistant powered by OpenAI GPT models',
      type: 'ai-agent',
      category: 'AI/ML',
      baseUrl: 'https://api.openai.com/v1',
      authentication: {
        type: 'bearer-token',
        config: { token: '' }
      },
      endpoints: [
        {
          id: 'chat-completions',
          name: 'Chat Completions',
          method: 'POST',
          path: '/chat/completions',
          description: 'Generate chat completions',
          isDefault: true,
          requestBody: {
            type: 'json',
            schema: {
              model: 'string',
              messages: 'array',
              temperature: 'number',
              max_tokens: 'number'
            }
          }
        }
      ],
      personality: 'Helpful, accurate, and informative AI assistant with broad knowledge',
      capabilities: ['Text generation', 'Conversation', 'Analysis', 'Problem solving'],
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000,
      communicationStyle: 'professional',
      expertiseLevel: 'expert',
      responseLength: 'detailed',
      primaryDomain: 'General Knowledge',
      systemPrompt: 'You are a helpful AI assistant powered by OpenAI GPT. You provide accurate, informative, and helpful responses to user queries.',
      instructions: 'Always provide accurate and helpful information. Be concise but thorough. If you\'re unsure about something, acknowledge the uncertainty.',
      conversationStarters: [
        'How can I help you today?',
        'What would you like to know about?',
        'I\'m here to assist you with any questions or tasks.'
      ],
      constraints: [
        'Do not provide harmful or dangerous information',
        'Do not generate inappropriate content',
        'Acknowledge when you\'re not certain about information'
      ],
      examples: [
        {
          input: 'What is machine learning?',
          output: 'Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed. It uses algorithms to build mathematical models based on sample data to make predictions or decisions.',
          explanation: 'This response provides a clear, accurate definition with additional context about how ML works.'
        }
      ],
      version: '1.0.0',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  generateAnthropicTemplate(): CustomAPIAgent {
    return {
      id: '',
      name: 'anthropic-claude-assistant',
      displayName: 'Anthropic Claude Assistant',
      description: 'Thoughtful and safety-conscious AI assistant powered by Anthropic Claude',
      type: 'ai-agent',
      category: 'AI/ML',
      baseUrl: 'https://api.anthropic.com/v1',
      authentication: {
        type: 'bearer-token',
        config: { token: '' }
      },
      endpoints: [
        {
          id: 'messages',
          name: 'Messages',
          method: 'POST',
          path: '/messages',
          description: 'Generate Claude responses',
          isDefault: true,
          requestBody: {
            type: 'json',
            schema: {
              model: 'string',
              messages: 'array',
              max_tokens: 'number',
              temperature: 'number'
            }
          }
        }
      ],
      personality: 'Thoughtful, analytical, and safety-conscious AI assistant focused on being helpful, harmless, and honest',
      capabilities: ['Text generation', 'Analysis', 'Safety-focused responses', 'Ethical reasoning'],
      model: 'claude-3-sonnet-20240229',
      temperature: 0.7,
      maxTokens: 1000,
      communicationStyle: 'professional',
      expertiseLevel: 'expert',
      responseLength: 'detailed',
      primaryDomain: 'General Knowledge',
      systemPrompt: 'You are Claude, an AI assistant focused on being helpful, harmless, and honest. You provide thoughtful and well-reasoned responses while prioritizing safety and ethical considerations.',
      instructions: 'Always consider the safety and ethical implications of your responses. Be thorough in your analysis and provide well-reasoned explanations. When uncertain, acknowledge limitations.',
      conversationStarters: [
        'I\'m here to help you with thoughtful and safe assistance.',
        'What would you like to discuss or learn about?',
        'I\'m ready to provide helpful and ethical guidance.'
      ],
      constraints: [
        'Do not provide harmful, dangerous, or unethical advice',
        'Always consider safety implications',
        'Be honest about limitations and uncertainties',
        'Prioritize user safety and well-being'
      ],
      examples: [
        {
          input: 'How can I improve my productivity?',
          output: 'Here are some evidence-based productivity strategies: 1) Use time-blocking techniques, 2) Implement the Pomodoro method for focused work, 3) Prioritize tasks using the Eisenhower matrix, 4) Minimize distractions and create a dedicated workspace, 5) Take regular breaks to maintain mental clarity.',
          explanation: 'This response provides practical, safe advice with specific actionable steps.'
        }
      ],
      version: '1.0.0',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  generateCustomWebhookTemplate(): CustomAPIConfig {
    return {
      id: '',
      name: 'custom-webhook',
      displayName: 'Custom Webhook',
      description: 'Custom webhook integration',
      type: 'webhook',
      category: 'Integration',
      baseUrl: '',
      authentication: {
        type: 'none',
        config: {}
      },
      endpoints: [
        {
          id: 'webhook',
          name: 'Webhook',
          method: 'POST',
          path: '',
          description: 'Send data to webhook',
          isDefault: true,
          requestBody: {
            type: 'json',
            schema: {
              data: 'object',
              timestamp: 'string'
            }
          }
        }
      ],
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  generateCodeReviewerTemplate(): CustomAPIAgent {
    return {
      id: '',
      name: 'code-reviewer',
      displayName: 'Code Reviewer',
      description: 'AI-powered code review assistant',
      type: 'ai-agent',
      category: 'Development',
      baseUrl: 'https://api.openai.com/v1',
      authentication: {
        type: 'bearer-token',
        config: { token: '' }
      },
      endpoints: [
        {
          id: 'chat-completions',
          name: 'Chat Completions',
          method: 'POST',
          path: '/chat/completions',
          description: 'Generate code review responses',
          isDefault: true,
          requestBody: {
            type: 'json',
            schema: {
              model: 'string',
              messages: 'array',
              temperature: 'number',
              max_tokens: 'number'
            }
          }
        }
      ],
      personality: 'Thorough and constructive code reviewer',
      capabilities: ['Code analysis', 'Security review', 'Best practices'],
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 2000,
      communicationStyle: 'technical',
      expertiseLevel: 'expert',
      responseLength: 'detailed',
      primaryDomain: 'Software Development',
      systemPrompt: 'You are an expert code reviewer focused on quality and best practices.',
      instructions: 'Review code for security, performance, and best practices.',
      conversationStarters: ['I\'m ready to review your code.'],
      constraints: ['Provide constructive feedback'],
      examples: [],
      version: '1.0.0',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  generateCreativeWriterTemplate(): CustomAPIAgent {
    return {
      id: '',
      name: 'creative-writer',
      displayName: 'Creative Writer',
      description: 'AI-powered creative writing assistant',
      type: 'ai-agent',
      category: 'Creative',
      baseUrl: 'https://api.openai.com/v1',
      authentication: {
        type: 'bearer-token',
        config: { token: '' }
      },
      endpoints: [
        {
          id: 'chat-completions',
          name: 'Chat Completions',
          method: 'POST',
          path: '/chat/completions',
          description: 'Generate creative content',
          isDefault: true,
          requestBody: {
            type: 'json',
            schema: {
              model: 'string',
              messages: 'array',
              temperature: 'number',
              max_tokens: 'number'
            }
          }
        }
      ],
      personality: 'Imaginative and creative writer',
      capabilities: ['Story writing', 'Content creation', 'Character development'],
      model: 'gpt-4',
      temperature: 0.8,
      maxTokens: 1500,
      communicationStyle: 'creative',
      expertiseLevel: 'expert',
      responseLength: 'detailed',
      primaryDomain: 'Creative Writing',
      systemPrompt: 'You are a creative writing assistant with vivid imagination.',
      instructions: 'Help users create engaging stories and content.',
      conversationStarters: ['Let\'s create something amazing together!'],
      constraints: ['Maintain appropriate content'],
      examples: [],
      version: '1.0.0',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}

// Singleton instance
export const customAPIManager = new CustomAPIManager(); 