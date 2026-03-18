'use client';

import React, { useState, useEffect } from 'react';
import { 
  CustomAPIConfig, 
  CustomAPIAgent, 
  CustomAPIEndpoint,
  CustomAPIParameter,
  CustomAPIRequestBody,
  customAPIManager 
} from '@/lib/custom-api-manager';

interface CustomAPIManagerProps {
  onAPICreated?: (api: CustomAPIConfig) => void;
  onAPIDeleted?: (apiId: string) => void;
}

export default function CustomAPIManager({ onAPICreated, onAPIDeleted }: CustomAPIManagerProps) {
  const [apis, setApis] = useState<CustomAPIConfig[]>([]);
  const [selectedAPI, setSelectedAPI] = useState<CustomAPIConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState<Partial<CustomAPIConfig>>({
    name: '',
    displayName: '',
    description: '',
    type: 'ai-agent',
    category: '',
    baseUrl: '',
    authentication: {
      type: 'none',
      config: {}
    },
    endpoints: [],
    headers: {},
    timeout: 30000,
    isActive: false,
    tags: [],
    version: '1.0.0'
  });

  // AI Agent specific form state
  const [agentFormData, setAgentFormData] = useState<Partial<CustomAPIAgent>>({
    personality: '',
    capabilities: [],
    systemPrompt: '',
    instructions: '',
    conversationStarters: [],
    constraints: [],
    knowledgeBase: [],
    examples: [],
    communicationStyle: 'professional',
    expertiseLevel: 'expert',
    responseLength: 'detailed',
    primaryDomain: '',
    secondaryDomains: [],
    tools: [],
    temperature: 0.7,
    maxTokens: 1000,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0
  });

  useEffect(() => {
    loadAPIs();
  }, []);

  const loadAPIs = async () => {
    try {
      const response = await fetch('/api/custom-apis');
      const result = await response.json();
      if (result.success) {
        setApis(result.data);
      }
    } catch (error) {
      console.error('Failed to load APIs:', error);
    }
  };

  const handleCreateAPI = async () => {
    try {
      // Combine form data with agent-specific data for AI agents
      const finalFormData = formData.type === 'ai-agent' 
        ? { ...formData, ...agentFormData }
        : formData;

      const response = await fetch('/api/custom-apis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalFormData)
      });

      const result = await response.json();
      if (result.success) {
        setApis([...apis, result.data]);
        setIsCreating(false);
        resetForm();
        onAPICreated?.(result.data);
      } else {
        alert(result.error || 'Failed to create API');
      }
    } catch (error) {
      console.error('Failed to create API:', error);
      alert('Failed to create API');
    }
  };

  const handleUpdateAPI = async () => {
    if (!selectedAPI) return;

    try {
      const finalFormData = formData.type === 'ai-agent' 
        ? { ...formData, ...agentFormData }
        : formData;

      const response = await fetch('/api/custom-apis', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedAPI.id, ...finalFormData })
      });

      const result = await response.json();
      if (result.success) {
        setApis(apis.map(api => api.id === selectedAPI.id ? result.data : api));
        setIsEditing(false);
        setSelectedAPI(null);
        resetForm();
      } else {
        alert(result.error || 'Failed to update API');
      }
    } catch (error) {
      console.error('Failed to update API:', error);
      alert('Failed to update API');
    }
  };

  const handleDeleteAPI = async (apiId: string) => {
    if (!confirm('Are you sure you want to delete this API?')) return;

    try {
      const response = await fetch(`/api/custom-apis?apiId=${apiId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      if (result.success) {
        setApis(apis.filter(api => api.id !== apiId));
        onAPIDeleted?.(apiId);
      } else {
        alert(result.error || 'Failed to delete API');
      }
    } catch (error) {
      console.error('Failed to delete API:', error);
      alert('Failed to delete API');
    }
  };

  const handleTestAPI = async (api: CustomAPIConfig) => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/custom-apis/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiId: api.id,
          endpointId: api.endpoints.find(e => e.isDefault)?.id || api.endpoints[0]?.id
        })
      });

      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({ error: 'Test failed', details: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTemplateSelect = (templateType: string) => {
    let template: Partial<CustomAPIConfig>;

    switch (templateType) {
      case 'openai':
        template = customAPIManager.generateOpenAITemplate();
        break;
      case 'anthropic':
        template = customAPIManager.generateAnthropicTemplate();
        break;
      case 'webhook':
        template = customAPIManager.generateCustomWebhookTemplate();
        break;
      case 'code-reviewer':
        template = customAPIManager.generateCodeReviewerTemplate();
        break;
      case 'creative-writer':
        template = customAPIManager.generateCreativeWriterTemplate();
        break;
      default:
        return;
    }

    setFormData(template);
    if (template.type === 'ai-agent') {
      setAgentFormData(template as CustomAPIAgent);
    }
    setSelectedTemplate(templateType);
    setShowTemplates(false);
    setIsCreating(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      description: '',
      type: 'ai-agent',
      category: '',
      baseUrl: '',
      authentication: { type: 'none', config: {} },
      endpoints: [],
      headers: {},
      timeout: 30000,
      isActive: false,
      tags: [],
      version: '1.0.0'
    });
    setAgentFormData({
      personality: '',
      capabilities: [],
      systemPrompt: '',
      instructions: '',
      conversationStarters: [],
      constraints: [],
      knowledgeBase: [],
      examples: [],
      communicationStyle: 'professional',
      expertiseLevel: 'expert',
      responseLength: 'detailed',
      primaryDomain: '',
      secondaryDomains: [],
      tools: [],
      temperature: 0.7,
      maxTokens: 1000,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0
    });
  };

  const addEndpoint = () => {
    const newEndpoint: CustomAPIEndpoint = {
      id: `endpoint_${Date.now()}`,
      name: '',
      method: 'GET',
      path: '',
      description: '',
      parameters: [],
      isDefault: false
    };

    setFormData({
      ...formData,
      endpoints: [...(formData.endpoints || []), newEndpoint]
    });
  };

  const updateEndpoint = (index: number, updates: Partial<CustomAPIEndpoint>) => {
    const updatedEndpoints = [...(formData.endpoints || [])];
    updatedEndpoints[index] = { ...updatedEndpoints[index], ...updates };
    setFormData({ ...formData, endpoints: updatedEndpoints });
  };

  const removeEndpoint = (index: number) => {
    const updatedEndpoints = (formData.endpoints || []).filter((_, i) => i !== index);
    setFormData({ ...formData, endpoints: updatedEndpoints });
  };

  const addParameter = (endpointIndex: number) => {
    const newParameter: CustomAPIParameter = {
      name: '',
      type: 'string',
      required: false,
      description: ''
    };

    const updatedEndpoints = [...(formData.endpoints || [])];
    updatedEndpoints[endpointIndex].parameters = [
      ...(updatedEndpoints[endpointIndex].parameters || []),
      newParameter
    ];

    setFormData({ ...formData, endpoints: updatedEndpoints });
  };

  const updateParameter = (endpointIndex: number, paramIndex: number, updates: Partial<CustomAPIParameter>) => {
    const updatedEndpoints = [...(formData.endpoints || [])];
    updatedEndpoints[endpointIndex].parameters = [
      ...(updatedEndpoints[endpointIndex].parameters || [])
    ];
    updatedEndpoints[endpointIndex].parameters[paramIndex] = {
      ...updatedEndpoints[endpointIndex].parameters[paramIndex],
      ...updates
    };

    setFormData({ ...formData, endpoints: updatedEndpoints });
  };

  const removeParameter = (endpointIndex: number, paramIndex: number) => {
    const updatedEndpoints = [...(formData.endpoints || [])];
    updatedEndpoints[endpointIndex].parameters = updatedEndpoints[endpointIndex].parameters?.filter((_, i) => i !== paramIndex) || [];
    setFormData({ ...formData, endpoints: updatedEndpoints });
  };

  const renderAuthenticationConfig = () => {
    const authType = formData.authentication?.type || 'none';

    switch (authType) {
      case 'api-key':
        return (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Header Name (e.g., X-API-Key)"
              value={formData.authentication?.config?.headerName || ''}
              onChange={(e) => setFormData({
                ...formData,
                authentication: {
                  ...formData.authentication!,
                  config: { ...formData.authentication?.config, headerName: e.target.value }
                }
              })}
              className="w-full p-2 border rounded"
            />
            <input
              type="password"
              placeholder="API Key"
              value={formData.authentication?.config?.apiKey || ''}
              onChange={(e) => setFormData({
                ...formData,
                authentication: {
                  ...formData.authentication!,
                  config: { ...formData.authentication?.config, apiKey: e.target.value }
                }
              })}
              className="w-full p-2 border rounded"
            />
          </div>
        );

      case 'bearer-token':
        return (
          <input
            type="password"
            placeholder="Bearer Token"
            value={formData.authentication?.config?.token || ''}
            onChange={(e) => setFormData({
              ...formData,
              authentication: {
                ...formData.authentication!,
                config: { ...formData.authentication?.config, token: e.target.value }
              }
            })}
            className="w-full p-2 border rounded"
          />
        );

      case 'basic-auth':
        return (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Username"
              value={formData.authentication?.config?.username || ''}
              onChange={(e) => setFormData({
                ...formData,
                authentication: {
                  ...formData.authentication!,
                  config: { ...formData.authentication?.config, username: e.target.value }
                }
              })}
              className="w-full p-2 border rounded"
            />
            <input
              type="password"
              placeholder="Password"
              value={formData.authentication?.config?.password || ''}
              onChange={(e) => setFormData({
                ...formData,
                authentication: {
                  ...formData.authentication!,
                  config: { ...formData.authentication?.config, password: e.target.value }
                }
              })}
              className="w-full p-2 border rounded"
            />
          </div>
        );

      default:
        return null;
    }
  };

  const renderAIAgentForm = () => {
    if (formData.type !== 'ai-agent') return null;

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">AI Agent Configuration</h3>
        
        {/* Basic Agent Properties */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Personality</label>
            <textarea
              value={agentFormData.personality || ''}
              onChange={(e) => setAgentFormData({ ...agentFormData, personality: e.target.value })}
              placeholder="Describe the agent's personality and character..."
              className="w-full p-2 border rounded"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Primary Domain</label>
            <input
              type="text"
              value={agentFormData.primaryDomain || ''}
              onChange={(e) => setAgentFormData({ ...agentFormData, primaryDomain: e.target.value })}
              placeholder="e.g., Software Development, Creative Writing"
              className="w-full p-2 border rounded"
            />
          </div>
        </div>

        {/* Communication Style */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Communication Style</label>
            <select
              value={agentFormData.communicationStyle || 'professional'}
              onChange={(e) => setAgentFormData({ ...agentFormData, communicationStyle: e.target.value as any })}
              className="w-full p-2 border rounded"
            >
              <option value="formal">Formal</option>
              <option value="casual">Casual</option>
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="technical">Technical</option>
              <option value="creative">Creative</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Expertise Level</label>
            <select
              value={agentFormData.expertiseLevel || 'expert'}
              onChange={(e) => setAgentFormData({ ...agentFormData, expertiseLevel: e.target.value as any })}
              className="w-full p-2 border rounded"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Response Length</label>
            <select
              value={agentFormData.responseLength || 'detailed'}
              onChange={(e) => setAgentFormData({ ...agentFormData, responseLength: e.target.value as any })}
              className="w-full p-2 border rounded"
            >
              <option value="concise">Concise</option>
              <option value="detailed">Detailed</option>
              <option value="comprehensive">Comprehensive</option>
            </select>
          </div>
        </div>

        {/* System Prompt */}
        <div>
          <label className="block text-sm font-medium mb-2">System Prompt</label>
          <textarea
            value={agentFormData.systemPrompt || ''}
            onChange={(e) => setAgentFormData({ ...agentFormData, systemPrompt: e.target.value })}
            placeholder="Define the core behavior and role of your AI agent..."
            className="w-full p-2 border rounded"
            rows={4}
          />
        </div>

        {/* Instructions */}
        <div>
          <label className="block text-sm font-medium mb-2">Detailed Instructions</label>
          <textarea
            value={agentFormData.instructions || ''}
            onChange={(e) => setAgentFormData({ ...agentFormData, instructions: e.target.value })}
            placeholder="Provide detailed instructions on how the agent should behave..."
            className="w-full p-2 border rounded"
            rows={4}
          />
        </div>

        {/* Capabilities */}
        <div>
          <label className="block text-sm font-medium mb-2">Capabilities</label>
          <input
            type="text"
            value={agentFormData.capabilities?.join(', ') || ''}
            onChange={(e) => setAgentFormData({
              ...agentFormData,
              capabilities: e.target.value.split(',').map(s => s.trim()).filter(s => s)
            })}
            placeholder="Comma-separated list of capabilities"
            className="w-full p-2 border rounded"
          />
        </div>

        {/* Conversation Starters */}
        <div>
          <label className="block text-sm font-medium mb-2">Conversation Starters</label>
          <textarea
            value={agentFormData.conversationStarters?.join('\n') || ''}
            onChange={(e) => setAgentFormData({
              ...agentFormData,
              conversationStarters: e.target.value.split('\n').filter(s => s.trim())
            })}
            placeholder="One conversation starter per line..."
            className="w-full p-2 border rounded"
            rows={3}
          />
        </div>

        {/* Constraints */}
        <div>
          <label className="block text-sm font-medium mb-2">Constraints</label>
          <textarea
            value={agentFormData.constraints?.join('\n') || ''}
            onChange={(e) => setAgentFormData({
              ...agentFormData,
              constraints: e.target.value.split('\n').filter(s => s.trim())
            })}
            placeholder="What the agent should NOT do (one per line)..."
            className="w-full p-2 border rounded"
            rows={3}
          />
        </div>

        {/* Model Parameters */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Temperature</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={agentFormData.temperature || 0.7}
              onChange={(e) => setAgentFormData({ ...agentFormData, temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
            <span className="text-sm text-gray-600">{agentFormData.temperature || 0.7}</span>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Max Tokens</label>
            <input
              type="number"
              value={agentFormData.maxTokens || 1000}
              onChange={(e) => setAgentFormData({ ...agentFormData, maxTokens: parseInt(e.target.value) })}
              className="w-full p-2 border rounded"
            />
          </div>
        </div>
      </div>
    );
  };

  const filteredAPIs = apis.filter(api => {
    const matchesSearch = searchQuery === '' || 
      api.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      api.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      api.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || api.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...Array.from(new Set(apis.map(api => api.category)))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Custom API Manager</h2>
        <div className="space-x-2">
          <button
            onClick={() => setShowTemplates(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Use Template
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Create New API
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex space-x-4">
        <input
          type="text"
          placeholder="Search APIs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 p-2 border rounded"
        />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="p-2 border rounded"
        >
          {categories.map(category => (
            <option key={category} value={category}>
              {category === 'all' ? 'All Categories' : category}
            </option>
          ))}
        </select>
      </div>

      {/* Template Selection Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Choose Template</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleTemplateSelect('openai')}
                className="p-4 text-left border rounded hover:bg-gray-50"
              >
                <div className="font-medium">OpenAI GPT Assistant</div>
                <div className="text-sm text-gray-600">Advanced AI assistant with comprehensive prompt engineering</div>
              </button>
              <button
                onClick={() => handleTemplateSelect('anthropic')}
                className="p-4 text-left border rounded hover:bg-gray-50"
              >
                <div className="font-medium">Anthropic Claude Assistant</div>
                <div className="text-sm text-gray-600">Safety-conscious AI with ethical considerations</div>
              </button>
              <button
                onClick={() => handleTemplateSelect('code-reviewer')}
                className="p-4 text-left border rounded hover:bg-gray-50"
              >
                <div className="font-medium">Code Review Expert</div>
                <div className="text-sm text-gray-600">Specialized in code analysis and security</div>
              </button>
              <button
                onClick={() => handleTemplateSelect('creative-writer')}
                className="p-4 text-left border rounded hover:bg-gray-50"
              >
                <div className="font-medium">Creative Writing Assistant</div>
                <div className="text-sm text-gray-600">Expert in storytelling and content creation</div>
              </button>
              <button
                onClick={() => handleTemplateSelect('webhook')}
                className="p-4 text-left border rounded hover:bg-gray-50"
              >
                <div className="font-medium">Custom Webhook</div>
                <div className="text-sm text-gray-600">Generic webhook integration</div>
              </button>
            </div>
            <button
              onClick={() => setShowTemplates(false)}
              className="mt-4 w-full p-2 bg-gray-300 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* API Creation/Editing Form */}
      {(isCreating || isEditing) && (
        <div className="bg-white p-6 rounded-lg shadow max-h-[90vh] overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">
            {isEditing ? 'Edit API' : 'Create New API'}
          </h3>

          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Internal Name*</label>
                <input
                  type="text"
                  placeholder="e.g., my-custom-assistant"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2 border rounded"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Use lowercase, hyphens, and underscores only. No spaces or special characters.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Display Name*</label>
                <input
                  type="text"
                  placeholder="e.g., My Custom Assistant"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full p-2 border rounded"
                />
                <p className="text-xs text-gray-600 mt-1">
                  User-friendly name that will be displayed in the UI.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="p-2 border rounded"
              >
                <option value="ai-agent">AI Agent</option>
                <option value="data-api">Data API</option>
                <option value="service-api">Service API</option>
                <option value="webhook">Webhook</option>
              </select>
              <input
                type="text"
                placeholder="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="p-2 border rounded"
              />
            </div>

            <textarea
              placeholder="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2 border rounded"
              rows={3}
            />

            <div className="grid grid-cols-2 gap-4">
              <input
                type="url"
                placeholder="Base URL"
                value={formData.baseUrl}
                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                className="p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Tags (comma-separated)"
                value={formData.tags?.join(', ') || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  tags: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                })}
                className="p-2 border rounded"
              />
            </div>

            {/* Authentication */}
            <div>
              <label className="block text-sm font-medium mb-2">Authentication</label>
              <select
                value={formData.authentication?.type}
                onChange={(e) => setFormData({
                  ...formData,
                  authentication: { type: e.target.value as any, config: {} }
                })}
                className="w-full p-2 border rounded mb-2"
              >
                <option value="none">None</option>
                <option value="api-key">API Key</option>
                <option value="bearer-token">Bearer Token</option>
                <option value="basic-auth">Basic Auth</option>
                <option value="oauth2">OAuth 2.0</option>
                <option value="custom">Custom</option>
              </select>
              {renderAuthenticationConfig()}
            </div>

            {/* AI Agent Specific Configuration */}
            {renderAIAgentForm()}

            {/* Endpoints */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium">Endpoints</label>
                <button
                  onClick={addEndpoint}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Add Endpoint
                </button>
              </div>

              {formData.endpoints?.map((endpoint, index) => (
                <div key={endpoint.id} className="border rounded p-4 mb-4">
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Name"
                      value={endpoint.name}
                      onChange={(e) => updateEndpoint(index, { name: e.target.value })}
                      className="p-2 border rounded"
                    />
                    <select
                      value={endpoint.method}
                      onChange={(e) => updateEndpoint(index, { method: e.target.value as any })}
                      className="p-2 border rounded"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Path"
                      value={endpoint.path}
                      onChange={(e) => updateEndpoint(index, { path: e.target.value })}
                      className="p-2 border rounded"
                    />
                  </div>

                  <textarea
                    placeholder="Description"
                    value={endpoint.description}
                    onChange={(e) => updateEndpoint(index, { description: e.target.value })}
                    className="w-full p-2 border rounded mb-2"
                    rows={2}
                  />

                  <div className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      checked={endpoint.isDefault}
                      onChange={(e) => updateEndpoint(index, { isDefault: e.target.checked })}
                      className="rounded"
                    />
                    <label className="text-sm">Default endpoint</label>
                  </div>

                  <button
                    onClick={() => removeEndpoint(index)}
                    className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  >
                    Remove Endpoint
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setIsCreating(false);
                  setIsEditing(false);
                  setSelectedAPI(null);
                  resetForm();
                }}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={isEditing ? handleUpdateAPI : handleCreateAPI}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {isEditing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API List */}
      <div className="space-y-4">
        {filteredAPIs.map((api) => (
          <div key={api.id} className="bg-white p-4 rounded-lg shadow">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h3 className="text-lg font-semibold">{api.displayName}</h3>
                  <span className="text-sm text-gray-500">({api.name})</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    api.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {api.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    {api.type}
                  </span>
                </div>
                <p className="text-gray-600 mb-2">{api.description}</p>
                <div className="text-sm text-gray-500">
                  <span>Base URL: {api.baseUrl}</span>
                  <span className="mx-2">•</span>
                  <span>Category: {api.category}</span>
                  {api.tags?.length && (
                    <>
                      <span className="mx-2">•</span>
                      <span>Tags: {api.tags.join(', ')}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => handleTestAPI(api)}
                  disabled={isTesting}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {isTesting ? 'Testing...' : 'Test'}
                </button>
                <button
                  onClick={() => {
                    setSelectedAPI(api);
                    setFormData(api);
                    if (api.type === 'ai-agent') {
                      setAgentFormData(api as CustomAPIAgent);
                    }
                    setIsEditing(true);
                  }}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteAPI(api.id)}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Test Result */}
            {testResult && selectedAPI?.id === api.id && (
              <div className="mt-4 p-3 border rounded">
                <h4 className="font-medium mb-2">Test Result:</h4>
                {testResult.success ? (
                  <div className="text-green-600">
                    <div>Status: Success</div>
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                      {JSON.stringify(testResult.data, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="text-red-600">
                    <div>Status: Failed</div>
                    <div className="text-sm">{testResult.error}</div>
                    {testResult.details && (
                      <div className="text-xs mt-1">{testResult.details}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {filteredAPIs.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchQuery || selectedCategory !== 'all' 
              ? 'No APIs match your search criteria.' 
              : 'No custom APIs configured yet. Create your first API to get started!'}
          </div>
        )}
      </div>
    </div>
  );
} 