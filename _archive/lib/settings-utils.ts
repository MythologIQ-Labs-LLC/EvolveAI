// Utility functions for Settings component

export interface SystemSpecs {
  os: 'windows' | 'macos' | 'linux';
  architecture: 'x64' | 'arm64';
  ram: number; // in GB
  cpu: {
    cores: number;
    model: string;
    hasAVX2: boolean;
  };
  gpu?: {
    model: string;
    vram: number; // in GB
    hasCUDA: boolean;
  };
  diskSpace: number; // in GB
}

export interface InstallResult {
  success: boolean;
  error?: string;
  progress?: number;
}

export interface TestResult {
  success: boolean;
  response?: string;
  error?: string;
}

export interface GoogleAPITestResult {
  success: boolean;
  error?: string;
}

/**
 * Get system specifications
 */
export async function getSystemSpecs(): Promise<SystemSpecs> {
  try {
    const response = await fetch('/api/local-llm/system-specs');
    const data = await response.json();
    
    if (data.success) {
      return data.data.systemSpecs;
    } else {
      throw new Error(data.error || 'Failed to get system specs');
    }
  } catch (error) {
    console.error('Failed to get system specs:', error);
    // Return mock data as fallback
    return {
      os: 'windows',
      architecture: 'x64',
      ram: 16,
      cpu: {
        cores: 8,
        model: 'Intel Core i7',
        hasAVX2: true,
      },
      gpu: {
        model: 'NVIDIA RTX 3060',
        vram: 12,
        hasCUDA: true,
      },
      diskSpace: 100,
    };
  }
}

/**
 * Get list of installed models
 */
export async function getInstalledModels(): Promise<string[]> {
  try {
    // For now, return an empty array since we don't have an endpoint for this
    // In a real implementation, this would call an API to get installed models
    return [];
  } catch (error) {
    console.error('Failed to get installed models:', error);
    return [];
  }
}

/**
 * Test Google API connection
 */
export async function testGoogleAPIConnection(): Promise<GoogleAPITestResult> {
  try {
    const apiKey = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('google-api-key') || '' : '';
    const accessToken = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('google-access-token') || '' : '';
    
    const response = await fetch('/api/google/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        accessToken,
        apiName: 'gmail'
      })
    });
    
    const data = await response.json();
    
    return {
      success: data.success,
      error: data.error
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Install a local LLM model
 */
export async function installLocalLLM(modelName: string): Promise<InstallResult> {
  try {
    const response = await fetch('/api/local-llm/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'install-model',
        modelName
      })
    });
    
    const data = await response.json();
    
    return {
      success: data.success,
      error: data.error,
      progress: data.progress
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
} 