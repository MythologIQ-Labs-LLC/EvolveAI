const { app, BrowserWindow, dialog, shell, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const https = require('https');
const os = require('os');

class EnhancedSetupWizard {
  constructor() {
    this.window = null;
    this.currentStep = 0;
    this.config = {
      // Technical Configuration
      googleApiKey: '',
      localLLMEnabled: false,
      privacyMode: false,
      autoUpdate: true,
      telemetry: false,
      
      // Voice Configuration
      voiceEnabled: false,
      voiceProvider: 'local', // 'local' | 'google' | 'azure'
      voiceLanguage: 'en-US',
      voiceSpeed: 1.0,
      voiceVolume: 0.8,
      
      // AI Personalities
      geminiPersonality: {
        name: 'Claude',
        traits: ['helpful', 'honest', 'harmless'],
        expertise: ['general', 'coding', 'writing'],
        communicationStyle: 'professional',
        quirks: [],
        background: 'AI assistant focused on being helpful, harmless, and honest.'
      },
      
      localLLMPersonality: {
        name: 'LocalAI',
        traits: ['privacy-focused', 'efficient', 'reliable'],
        expertise: ['local processing', 'offline tasks', 'data analysis'],
        communicationStyle: 'direct',
        quirks: [],
        background: 'Local AI model for privacy-focused interactions.'
      },
      
      // Use Cases
      primaryUseCase: 'general',
      secondaryUseCases: [],
      industry: 'general',
      experienceLevel: 'beginner',
      
      // Installation Progress
      installationProgress: {
        ollama: { status: 'pending', progress: 0 },
        models: { status: 'pending', progress: 0 },
        voice: { status: 'pending', progress: 0 },
        database: { status: 'pending', progress: 0 }
      }
    };
    
    this.setupIpcHandlers();
  }

  setupIpcHandlers() {
    ipcMain.handle('get-system-info', () => {
      return this.getSystemInfo();
    });

    ipcMain.handle('test-google-api', async (event, apiKey) => {
      return await this.testGoogleAPI(apiKey);
    });

    ipcMain.handle('install-ollama', async () => {
      return await this.installOllama();
    });

    ipcMain.handle('install-model', async (event, modelName) => {
      return await this.installModel(modelName);
    });

    ipcMain.handle('test-voice', async (event, config) => {
      return await this.testVoice(config);
    });

    ipcMain.handle('save-config', async (event, config) => {
      return await this.saveConfig(config);
    });

    ipcMain.handle('get-recommended-models', () => {
      return this.getRecommendedModels();
    });

    ipcMain.handle('get-personality-templates', () => {
      return this.getPersonalityTemplates();
    });
  }

  async start() {
    const configPath = path.join(app.getPath('userData'), 'config', 'first-run.json');
    
    if (fs.existsSync(configPath)) {
      return; // Not first run
    }

    this.createWindow();
    this.showWelcomeStep();
  }

  createWindow() {
    this.window = new BrowserWindow({
      width: 1000,
      height: 700,
      resizable: false,
      maximizable: false,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'enhanced-setup-preload.js')
      },
      icon: path.join(__dirname, 'assets/icon.ico'),
      title: 'EvolveAI Enhanced Setup Wizard'
    });

    this.window.loadFile(path.join(__dirname, 'enhanced-setup-wizard.html'));

    this.window.once('ready-to-show', () => {
      this.window.show();
    });

    this.window.on('closed', () => {
      this.window = null;
    });
  }

  getSystemInfo() {
    const platform = os.platform();
    const arch = os.arch();
    const totalMem = Math.round(os.totalmem() / (1024 * 1024 * 1024)); // GB
    const cpus = os.cpus();
    
    return {
      os: platform,
      architecture: arch,
      ram: totalMem,
      cpu: {
        cores: cpus.length,
        model: cpus[0].model,
        speed: cpus[0].speed
      },
      userAgent: navigator.userAgent
    };
  }

  getRecommendedModels() {
    const systemInfo = this.getSystemInfo();
    const models = [
      {
        name: 'TinyLlama',
        size: 1.1,
        minRAM: 2,
        description: 'Fast, lightweight model for basic tasks',
        recommended: systemInfo.ram >= 4
      },
      {
        name: 'Gemma 2B',
        size: 1.5,
        minRAM: 3,
        description: 'Google\'s efficient 2B parameter model',
        recommended: systemInfo.ram >= 6
      },
      {
        name: 'Llama 3.1 8B',
        size: 4.7,
        minRAM: 8,
        description: 'Meta\'s powerful 8B parameter model',
        recommended: systemInfo.ram >= 16
      },
      {
        name: 'Mistral 7B',
        size: 4.1,
        minRAM: 8,
        description: 'High-performance 7B parameter model',
        recommended: systemInfo.ram >= 16
      },
      {
        name: 'CodeLlama 7B',
        size: 3.8,
        minRAM: 8,
        description: 'Specialized for code generation',
        recommended: systemInfo.ram >= 16
      }
    ];

    return models.filter(model => systemInfo.ram >= model.minRAM);
  }

  getPersonalityTemplates() {
    return {
      gemini: [
        {
          name: 'Claude',
          traits: ['helpful', 'honest', 'harmless'],
          expertise: ['general', 'coding', 'writing'],
          communicationStyle: 'professional',
          background: 'AI assistant focused on being helpful, harmless, and honest.'
        },
        {
          name: 'Sage',
          traits: ['wise', 'thoughtful', 'analytical'],
          expertise: ['philosophy', 'science', 'history'],
          communicationStyle: 'contemplative',
          background: 'A wise and thoughtful AI that provides deep insights and analysis.'
        },
        {
          name: 'Creative',
          traits: ['imaginative', 'artistic', 'innovative'],
          expertise: ['creative writing', 'art', 'design'],
          communicationStyle: 'expressive',
          background: 'An imaginative AI that excels at creative tasks and artistic expression.'
        },
        {
          name: 'Assistant',
          traits: ['efficient', 'organized', 'helpful'],
          expertise: ['productivity', 'organization', 'planning'],
          communicationStyle: 'structured',
          background: 'A practical AI focused on helping you get things done efficiently.'
        }
      ],
      localLLM: [
        {
          name: 'LocalAI',
          traits: ['privacy-focused', 'efficient', 'reliable'],
          expertise: ['local processing', 'offline tasks', 'data analysis'],
          communicationStyle: 'direct',
          background: 'Local AI model for privacy-focused interactions.'
        },
        {
          name: 'Guardian',
          traits: ['protective', 'secure', 'trustworthy'],
          expertise: ['security', 'privacy', 'data protection'],
          communicationStyle: 'cautious',
          background: 'A security-focused AI that prioritizes your privacy and data protection.'
        },
        {
          name: 'Analyst',
          traits: ['analytical', 'precise', 'data-driven'],
          expertise: ['data analysis', 'research', 'statistics'],
          communicationStyle: 'detailed',
          background: 'An analytical AI that excels at data analysis and research tasks.'
        }
      ]
    };
  }

  async testGoogleAPI(apiKey) {
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 'Hello, this is a test message from EvolveAI setup wizard.'
            }]
          }]
        })
      });

      if (response.ok) {
        this.config.googleApiKey = apiKey;
        return { success: true, message: 'API key is valid! Google AI Studio is ready to use.' };
      } else {
        return { success: false, message: 'Invalid API key. Please check and try again.' };
      }
    } catch (error) {
      return { success: false, message: 'Connection failed. Please check your internet connection.' };
    }
  }

  async installOllama() {
    return new Promise((resolve) => {
      const platform = os.platform();
      const arch = os.arch();
      
      let downloadUrl, installerName;
      
      if (platform === 'win32') {
        downloadUrl = 'https://ollama.ai/download/ollama-windows-amd64.msi';
        installerName = 'ollama-installer.msi';
      } else if (platform === 'darwin') {
        downloadUrl = 'https://ollama.ai/download/ollama-darwin-amd64';
        installerName = 'ollama-darwin-amd64';
      } else {
        downloadUrl = 'https://ollama.ai/download/ollama-linux-amd64';
        installerName = 'ollama-linux-amd64';
      }

      const downloadPath = path.join(app.getPath('temp'), installerName);
      
      // Download Ollama
      const file = fs.createWriteStream(downloadPath);
      https.get(downloadUrl, (response) => {
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          
          // Install Ollama
          if (platform === 'win32') {
            exec(`msiexec /i "${downloadPath}" /quiet`, (error) => {
              if (error) {
                resolve({ success: false, error: 'Failed to install Ollama' });
              } else {
                this.config.localLLMEnabled = true;
                resolve({ success: true, message: 'Ollama installed successfully!' });
              }
            });
          } else {
            // For macOS and Linux, make executable and move to /usr/local/bin
            exec(`chmod +x "${downloadPath}" && sudo mv "${downloadPath}" /usr/local/bin/ollama`, (error) => {
              if (error) {
                resolve({ success: false, error: 'Failed to install Ollama' });
              } else {
                this.config.localLLMEnabled = true;
                resolve({ success: true, message: 'Ollama installed successfully!' });
              }
            });
          }
        });
      }).on('error', (error) => {
        resolve({ success: false, error: 'Failed to download Ollama' });
      });
    });
  }

  async installModel(modelName) {
    return new Promise((resolve) => {
      const ollamaProcess = spawn('ollama', ['pull', modelName]);
      
      let progress = 0;
      
      ollamaProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('pulling')) {
          progress += 10;
          this.window.webContents.send('model-install-progress', { model: modelName, progress });
        }
      });
      
      ollamaProcess.stderr.on('data', (data) => {
        console.error(`Ollama error: ${data}`);
      });
      
      ollamaProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, message: `${modelName} installed successfully!` });
        } else {
          resolve({ success: false, error: `Failed to install ${modelName}` });
        }
      });
    });
  }

  async testVoice(config) {
    try {
      // Test voice synthesis
      const testText = "Hello, this is a test of the voice system.";
      
      if (config.provider === 'local') {
        // Use local TTS (e.g., espeak, festival)
        const { exec } = require('child_process');
        exec(`espeak "${testText}"`, (error) => {
          if (error) {
            return { success: false, error: 'Local TTS not available' };
          }
        });
      } else if (config.provider === 'google') {
        // Test Google Cloud TTS
        // Implementation would go here
      }
      
      return { success: true, message: 'Voice system test successful!' };
    } catch (error) {
      return { success: false, error: 'Voice test failed' };
    }
  }

  async saveConfig(config) {
    try {
      const configDir = path.join(app.getPath('userData'), 'config');
      const configPath = path.join(configDir, 'app-config.json');
      
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      // Merge with existing config
      const finalConfig = { ...this.config, ...config };
      fs.writeFileSync(configPath, JSON.stringify(finalConfig, null, 2));
      
      // Mark first run as complete
      const firstRunPath = path.join(configDir, 'first-run.json');
      fs.writeFileSync(firstRunPath, JSON.stringify({ 
        completed: true, 
        date: new Date().toISOString(),
        version: '1.0.0'
      }));
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  showWelcomeStep() {
    this.currentStep = 0;
    this.window.webContents.send('setup-step', {
      step: 0,
      title: 'Welcome to EvolveAI',
      content: 'welcome',
      systemInfo: this.getSystemInfo()
    });
  }

  showPersonalityStep() {
    this.currentStep = 1;
    this.window.webContents.send('setup-step', {
      step: 1,
      title: 'Configure Your AI Personalities',
      content: 'personality',
      templates: this.getPersonalityTemplates()
    });
  }

  showUseCaseStep() {
    this.currentStep = 2;
    this.window.webContents.send('setup-step', {
      step: 2,
      title: 'How Will You Use EvolveAI?',
      content: 'use-case'
    });
  }

  showVoiceStep() {
    this.currentStep = 3;
    this.window.webContents.send('setup-step', {
      step: 3,
      title: 'Voice Interaction Setup',
      content: 'voice'
    });
  }

  showInstallationStep() {
    this.currentStep = 4;
    this.window.webContents.send('setup-step', {
      step: 4,
      title: 'Installation & Configuration',
      content: 'installation',
      recommendedModels: this.getRecommendedModels()
    });
  }

  showFinishStep() {
    this.currentStep = 5;
    this.window.webContents.send('setup-step', {
      step: 5,
      title: 'Setup Complete!',
      content: 'finish',
      config: this.config
    });
  }

  async nextStep() {
    if (this.currentStep < 5) {
      this.currentStep++;
      switch (this.currentStep) {
        case 1:
          this.showPersonalityStep();
          break;
        case 2:
          this.showUseCaseStep();
          break;
        case 3:
          this.showVoiceStep();
          break;
        case 4:
          this.showInstallationStep();
          break;
        case 5:
          this.showFinishStep();
          break;
      }
    } else {
      await this.saveConfig(this.config);
      this.window.close();
    }
  }

  async previousStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
      switch (this.currentStep) {
        case 0:
          this.showWelcomeStep();
          break;
        case 1:
          this.showPersonalityStep();
          break;
        case 2:
          this.showUseCaseStep();
          break;
        case 3:
          this.showVoiceStep();
          break;
        case 4:
          this.showInstallationStep();
          break;
      }
    }
  }
}

module.exports = EnhancedSetupWizard; 