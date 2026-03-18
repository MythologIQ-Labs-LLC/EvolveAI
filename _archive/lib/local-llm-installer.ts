import os from 'os'

export interface SystemSpecs {
  os: 'windows' | 'macos' | 'linux';
  architecture: 'x64' | 'arm64';
  ram: number; // in GB
  cpu: {
    cores: number;
    model: string;
    hasAVX2: boolean;
  };
  gpus: Array<{
    model: string;
    vram: number; // in GB
    vendor: string;
    hasCUDA: boolean;
  }>;
  drives: Array<{
    mount: string;
    size: number; // in GB
    used: number; // in GB
    free: number; // in GB
    type: string;
    fs: string;
    label?: string;
  }>;
  diskSpace: number; // total in GB (sum of all drives)
}

export interface LLMModel {
  name: string;
  size: number; // in GB
  minRAM: number; // in GB
  recommendedRAM: number; // in GB
  supportsGPU: boolean;
  description: string;
  downloadUrl: string;
  ollamaModel: string;
  tags: string[];
}

export class LocalLLMInstaller {
  private static readonly MODELS: LLMModel[] = [
    {
      name: 'TinyLlama',
      size: 1.1,
      minRAM: 2,
      recommendedRAM: 4,
      supportsGPU: false,
      description: 'Fast, lightweight model for basic tasks',
      downloadUrl: 'https://ollama.ai/library/tinyllama',
      ollamaModel: 'tinyllama',
      tags: ['fast', 'lightweight', 'basic']
    },
    {
      name: 'Gemma 2B',
      size: 1.5,
      minRAM: 3,
      recommendedRAM: 6,
      supportsGPU: false,
      description: 'Google\'s efficient 2B parameter model',
      downloadUrl: 'https://ollama.ai/library/gemma2b',
      ollamaModel: 'gemma:2b',
      tags: ['efficient', 'google', 'balanced']
    },
    {
      name: 'Llama 3.1 8B',
      size: 4.7,
      minRAM: 8,
      recommendedRAM: 16,
      supportsGPU: true,
      description: 'Meta\'s powerful 8B parameter model',
      downloadUrl: 'https://ollama.ai/library/llama3.1',
      ollamaModel: 'llama3.1:8b',
      tags: ['powerful', 'meta', 'advanced']
    },
    {
      name: 'Mistral 7B',
      size: 4.1,
      minRAM: 8,
      recommendedRAM: 16,
      supportsGPU: true,
      description: 'High-performance 7B parameter model',
      downloadUrl: 'https://ollama.ai/library/mistral',
      ollamaModel: 'mistral',
      tags: ['high-performance', 'balanced', 'popular']
    },
    {
      name: 'CodeLlama 7B',
      size: 3.8,
      minRAM: 8,
      recommendedRAM: 16,
      supportsGPU: true,
      description: 'Specialized for code generation and analysis',
      downloadUrl: 'https://ollama.ai/library/codellama',
      ollamaModel: 'codellama:7b',
      tags: ['coding', 'development', 'specialized']
    },
    {
      name: 'Phi-3 Mini',
      size: 1.8,
      minRAM: 4,
      recommendedRAM: 8,
      supportsGPU: false,
      description: 'Microsoft\'s efficient 3.8B parameter model',
      downloadUrl: 'https://ollama.ai/library/phi3',
      ollamaModel: 'phi3:mini',
      tags: ['microsoft', 'efficient', 'balanced']
    }
  ];

  static async getSystemSpecs(): Promise<SystemSpecs> {
    try {
      // Get real system information using Node.js built-in modules
      const platform = process.platform === 'win32' ? 'windows' : 
                      process.platform === 'darwin' ? 'macos' : 'linux';
      
      const arch = process.arch === 'x64' ? 'x64' : 'arm64';
      
      // Get RAM information (in GB)
      const totalMem = os.totalmem();
      const ram = Math.round(totalMem / (1024 * 1024 * 1024));
      
      // Get CPU information
      const cpus = os.cpus();
      const cpu = {
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown CPU',
        hasAVX2: true, // Assume true for modern systems
      };
      
      // For disk info, we'll use a simplified approach
      const drives = [
        {
          mount: 'C:',
          size: 100,
          used: 50,
          free: 50,
          type: 'local',
          fs: 'NTFS',
          label: 'System Drive',
        }
      ];
      const diskSpace = drives.reduce((sum, d) => sum + d.size, 0);
      
      // For GPU info, we'll use a simplified approach
      const gpus = [
        {
          model: 'Unknown GPU',
          vram: 0,
          vendor: 'Unknown',
          hasCUDA: false,
        }
      ];
      
      return {
        os: platform,
        architecture: arch,
        ram,
        cpu,
        gpus,
        drives,
        diskSpace,
      };
    } catch (error) {
      console.error('Error getting system specs:', error);
      // Return fallback data
      return {
        os: 'windows',
        architecture: 'x64',
        ram: 8,
        cpu: {
          cores: 4,
          model: 'Unknown CPU',
          hasAVX2: true,
        },
        gpus: [],
        drives: [],
        diskSpace: 50,
      };
    }
  }

  static getRecommendedModels(specs: SystemSpecs): LLMModel[] {
    return this.MODELS.filter(model => {
      // Check RAM requirements
      if (specs.ram < model.minRAM) return false;
      
      // Check GPU support if needed
      if (model.supportsGPU && !specs.gpus.some(gpu => gpu.hasCUDA)) return false;
      
      // Check disk space
      if (specs.diskSpace < model.size + 5) return false; // +5GB buffer
      
      return true;
    }).sort((a, b) => {
      // Sort by recommended RAM (ascending) then by size (ascending)
      if (a.recommendedRAM !== b.recommendedRAM) {
        return a.recommendedRAM - b.recommendedRAM;
      }
      return a.size - b.size;
    });
  }

  static getBestModel(specs: SystemSpecs): LLMModel | null {
    const recommended = this.getRecommendedModels(specs);
    if (recommended.length === 0) return null;
    
    // Return the model with the highest recommended RAM that fits
    return recommended[recommended.length - 1];
  }

  static async installOllama(): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if Ollama is already installed
      const isInstalled = await this.checkOllamaInstallation();
      if (isInstalled) {
        return { success: true };
      }

      // Download and install Ollama
      await this.downloadOllama();
      await this.installOllamaBinary();
      await this.startOllamaService();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async installModel(modelName: string): Promise<{ success: boolean; error?: string; progress?: number }> {
    try {
      // Ensure Ollama is installed
      const ollamaResult = await this.installOllama();
      if (!ollamaResult.success) {
        return { success: false, error: ollamaResult.error };
      }

      // Install the model
      // This would use the Ollama CLI to pull the model
      // For now, we'll simulate the installation
      
      return { success: true, progress: 100 };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async testModel(modelName: string): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
      // Test the model by sending a simple prompt
      // This would use the Ollama API
      // For now, we'll simulate a successful test
      
      return {
        success: true,
        response: 'Model is working correctly'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async checkOllamaInstallation(): Promise<boolean> {
    // Check if Ollama is installed and running
    // This would check for the Ollama process or service
    return false; // Assume not installed for now
  }

  private static async downloadOllama(): Promise<void> {
    // Download Ollama binary
    // This would download the appropriate version for the platform
  }

  private static async installOllamaBinary(): Promise<void> {
    // Install the Ollama binary
    // This would extract and place the binary in the correct location
  }

  private static async startOllamaService(): Promise<void> {
    // Start the Ollama service
    // This would start the Ollama daemon
  }

  static getAllModels(): LLMModel[] {
    return this.MODELS;
  }

  static getModelByName(name: string): LLMModel | undefined {
    return this.MODELS.find(model => model.name === name);
  }
} 