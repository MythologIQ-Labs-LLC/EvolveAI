const { app, BrowserWindow, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');

class SetupWizard {
  constructor() {
    this.window = null;
    this.currentStep = 0;
    this.config = {
      googleApiKey: '',
      localLLMEnabled: false,
      privacyMode: false,
      autoUpdate: true,
      telemetry: false
    };
  }

  async start() {
    // Check if this is the first run
    const configPath = path.join(app.getPath('userData'), 'config', 'first-run.json');
    
    if (fs.existsSync(configPath)) {
      return; // Not first run
    }

    this.createWindow();
    this.showWelcomeStep();
  }

  createWindow() {
    this.window = new BrowserWindow({
      width: 800,
      height: 600,
      resizable: false,
      maximizable: false,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'setup-preload.js')
      },
      icon: path.join(__dirname, 'assets/icon.ico'),
      title: 'EvolveAI Setup Wizard'
    });

    this.window.loadFile(path.join(__dirname, 'setup-wizard.html'));

    this.window.once('ready-to-show', () => {
      this.window.show();
    });

    this.window.on('closed', () => {
      this.window = null;
    });
  }

  showWelcomeStep() {
    this.currentStep = 0;
    this.window.webContents.send('setup-step', {
      step: 0,
      title: 'Welcome to EvolveAI',
      content: `
        <div class="welcome-content">
          <h2>🎉 Welcome to EvolveAI!</h2>
          <p>You're about to experience the most advanced AI desktop application available. Let's get you set up in just a few steps.</p>
          
          <div class="features-list">
            <h3>What you'll get:</h3>
            <ul>
              <li>🤖 <strong>Hybrid AI Architecture</strong> - Google AI Studio + Local LLMs</li>
              <li>👥 <strong>Multi-AI Collaboration</strong> - Unlimited AI participants</li>
              <li>🔌 <strong>Custom API Manager</strong> - Add any external service</li>
              <li>🔒 <strong>Privacy-Focused</strong> - Local processing options</li>
              <li>💰 <strong>Cost-Effective</strong> - Free tier + smart routing</li>
              <li>🚀 <strong>Easy Setup</strong> - Get started in minutes</li>
            </ul>
          </div>
          
          <div class="next-steps">
            <p><strong>This wizard will help you:</strong></p>
            <ol>
              <li>Configure your Google AI Studio API (free)</li>
              <li>Set up local LLMs for privacy (optional)</li>
              <li>Choose your privacy and update preferences</li>
              <li>Create your first AI conversation</li>
            </ol>
          </div>
        </div>
      `
    });
  }

  showApiKeyStep() {
    this.currentStep = 1;
    this.window.webContents.send('setup-step', {
      step: 1,
      title: 'Google AI Studio Setup',
      content: `
        <div class="api-key-content">
          <h2>🔑 Google AI Studio API Key</h2>
          <p>EvolveAI uses Google AI Studio (formerly Gemini) for powerful AI conversations. This is completely free!</p>
          
          <div class="setup-instructions">
            <h3>How to get your free API key:</h3>
            <ol>
              <li>Visit <a href="#" onclick="openGoogleAIStudio()">Google AI Studio</a></li>
              <li>Sign in with your Google account</li>
              <li>Click "Create API Key"</li>
              <li>Copy the generated key</li>
              <li>Paste it below</li>
            </ol>
          </div>
          
          <div class="api-key-input">
            <label for="apiKey">API Key:</label>
            <input type="password" id="apiKey" placeholder="Enter your Google AI Studio API key">
            <button onclick="testApiKey()" class="test-button">Test Connection</button>
          </div>
          
          <div class="api-key-info">
            <p><strong>Why Google AI Studio?</strong></p>
            <ul>
              <li>✅ Completely free (60 requests/minute)</li>
              <li>✅ Real-time knowledge and updates</li>
              <li>✅ Advanced reasoning capabilities</li>
              <li>✅ Multi-modal support (text, images)</li>
              <li>✅ Privacy-focused (no data retention)</li>
            </ul>
          </div>
          
          <div class="skip-option">
            <p><em>Don't have an API key yet? You can skip this step and configure it later in Settings.</em></p>
          </div>
        </div>
      `
    });
  }

  showLocalLLMStep() {
    this.currentStep = 2;
    this.window.webContents.send('setup-step', {
      step: 2,
      title: 'Local LLM Setup (Optional)',
      content: `
        <div class="local-llm-content">
          <h2>🏠 Local AI Models</h2>
          <p>For maximum privacy and offline use, you can install local AI models using Ollama.</p>
          
          <div class="privacy-benefits">
            <h3>Privacy Benefits:</h3>
            <ul>
              <li>🔒 <strong>Complete Privacy</strong> - No data leaves your computer</li>
              <li>🌐 <strong>Offline Operation</strong> - Works without internet</li>
              <li>⚡ <strong>Fast Response</strong> - No network latency</li>
              <li>💰 <strong>No Costs</strong> - Completely free after installation</li>
              <li>🎛️ <strong>Full Control</strong> - Customize models and parameters</li>
            </ul>
          </div>
          
          <div class="ollama-setup">
            <h3>Ollama Installation:</h3>
            <div class="ollama-options">
              <div class="option">
                <h4>Automatic Installation</h4>
                <p>Let EvolveAI download and install Ollama for you</p>
                <button onclick="installOllama()" class="primary-button">Install Ollama</button>
              </div>
              
              <div class="option">
                <h4>Manual Installation</h4>
                <p>Download and install Ollama yourself</p>
                <button onclick="openOllamaWebsite()" class="secondary-button">Visit Ollama Website</button>
              </div>
            </div>
          </div>
          
          <div class="model-selection">
            <h3>Recommended Models:</h3>
            <div class="model-grid">
              <div class="model-card">
                <h4>Llama 2 (7B)</h4>
                <p>General purpose, good performance</p>
                <span class="size">4GB RAM</span>
              </div>
              <div class="model-card">
                <h4>Mistral (7B)</h4>
                <p>Fast and efficient</p>
                <span class="size">4GB RAM</span>
              </div>
              <div class="model-card">
                <h4>Code Llama (7B)</h4>
                <p>Specialized for coding</p>
                <span class="size">4GB RAM</span>
              </div>
            </div>
          </div>
          
          <div class="skip-option">
            <p><em>You can skip this step and install local models later in Settings.</em></p>
          </div>
        </div>
      `
    });
  }

  showPrivacyStep() {
    this.currentStep = 3;
    this.window.webContents.send('setup-step', {
      step: 3,
      title: 'Privacy & Updates',
      content: `
        <div class="privacy-content">
          <h2>🔒 Privacy & Update Settings</h2>
          <p>Configure how EvolveAI handles your data and stays up to date.</p>
          
          <div class="privacy-options">
            <div class="option-group">
              <h3>Privacy Mode</h3>
              <div class="option-item">
                <input type="checkbox" id="privacyMode">
                <label for="privacyMode">Enable Privacy Mode</label>
                <p>Use only local models, disable all external API calls</p>
              </div>
            </div>
            
            <div class="option-group">
              <h3>Automatic Updates</h3>
              <div class="option-item">
                <input type="checkbox" id="autoUpdate" checked>
                <label for="autoUpdate">Check for updates automatically</label>
                <p>Get the latest features and security updates</p>
              </div>
            </div>
            
            <div class="option-group">
              <h3>Usage Analytics</h3>
              <div class="option-item">
                <input type="checkbox" id="telemetry">
                <label for="telemetry">Send anonymous usage data</label>
                <p>Help improve EvolveAI (no personal information collected)</p>
              </div>
            </div>
          </div>
          
          <div class="privacy-info">
            <h3>Data Handling:</h3>
            <ul>
              <li>📁 <strong>Local Storage</strong> - All data stored on your computer</li>
              <li>🔐 <strong>Encrypted Keys</strong> - API keys encrypted at rest</li>
              <li>🚫 <strong>No Telemetry</strong> - Zero data collection by default</li>
              <li>🔄 <strong>Easy Export</strong> - Export your data anytime</li>
            </ul>
          </div>
        </div>
      `
    });
  }

  showFinishStep() {
    this.currentStep = 4;
    this.window.webContents.send('setup-step', {
      step: 4,
      title: 'Setup Complete!',
      content: `
        <div class="finish-content">
          <h2>🎉 You're All Set!</h2>
          <p>EvolveAI has been configured and is ready to use.</p>
          
          <div class="whats-next">
            <h3>What's Next:</h3>
            <div class="next-steps-grid">
              <div class="step-card">
                <h4>1. Start Chatting</h4>
                <p>Begin your first conversation with AI</p>
              </div>
              <div class="step-card">
                <h4>2. Explore Features</h4>
                <p>Try Conversational Mode with multiple AIs</p>
              </div>
              <div class="step-card">
                <h4>3. Add Custom APIs</h4>
                <p>Integrate your own services and AI agents</p>
              </div>
              <div class="step-card">
                <h4>4. Join Community</h4>
                <p>Get help and share ideas on GitHub</p>
              </div>
            </div>
          </div>
          
          <div class="quick-links">
            <h3>Quick Links:</h3>
            <div class="links-grid">
              <button onclick="openDocumentation()" class="link-button">📚 Documentation</button>
              <button onclick="openGitHub()" class="link-button">🐙 GitHub</button>
              <button onclick="openIssues()" class="link-button">🐛 Report Issues</button>
              <button onclick="openDiscord()" class="link-button">💬 Discord</button>
            </div>
          </div>
          
          <div class="support-info">
            <p><strong>Need Help?</strong></p>
            <ul>
              <li>📖 Check the comprehensive documentation</li>
              <li>🐛 Report bugs on GitHub Issues</li>
              <li>💡 Request features on GitHub Discussions</li>
              <li>💬 Join our Discord community</li>
            </ul>
          </div>
        </div>
      `
    });
  }

  async saveConfig() {
    const configDir = path.join(app.getPath('userData'), 'config');
    const configPath = path.join(configDir, 'app-config.json');
    
    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Save configuration
    fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
    
    // Mark first run as complete
    const firstRunPath = path.join(configDir, 'first-run.json');
    fs.writeFileSync(firstRunPath, JSON.stringify({ completed: true, date: new Date().toISOString() }));
  }

  async nextStep() {
    if (this.currentStep < 4) {
      this.currentStep++;
      switch (this.currentStep) {
        case 1:
          this.showApiKeyStep();
          break;
        case 2:
          this.showLocalLLMStep();
          break;
        case 3:
          this.showPrivacyStep();
          break;
        case 4:
          this.showFinishStep();
          break;
      }
    } else {
      await this.saveConfig();
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
          this.showApiKeyStep();
          break;
        case 2:
          this.showLocalLLMStep();
          break;
        case 3:
          this.showPrivacyStep();
          break;
      }
    }
  }

  async testApiKey(apiKey) {
    try {
      // Test the API key with a simple request
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 'Hello, this is a test message.'
            }]
          }]
        })
      });

      if (response.ok) {
        this.config.googleApiKey = apiKey;
        return { success: true, message: 'API key is valid!' };
      } else {
        return { success: false, message: 'Invalid API key. Please check and try again.' };
      }
    } catch (error) {
      return { success: false, message: 'Connection failed. Please check your internet connection.' };
    }
  }

  async installOllama() {
    try {
      // Download and install Ollama
      const { exec } = require('child_process');
      
      // For Windows, download the installer
      const ollamaUrl = 'https://ollama.ai/download/ollama-windows-amd64.msi';
      const downloadPath = path.join(app.getPath('temp'), 'ollama-installer.msi');
      
      // Download the installer
      const response = await fetch(ollamaUrl);
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(downloadPath, Buffer.from(buffer));
      
      // Run the installer
      exec(`msiexec /i "${downloadPath}" /quiet`, (error, stdout, stderr) => {
        if (error) {
          console.error('Ollama installation failed:', error);
          dialog.showErrorBox('Installation Failed', 'Failed to install Ollama. Please install it manually from https://ollama.ai');
        } else {
          this.config.localLLMEnabled = true;
          dialog.showMessageBox(this.window, {
            type: 'info',
            title: 'Installation Complete',
            message: 'Ollama has been installed successfully!'
          });
        }
      });
    } catch (error) {
      console.error('Ollama installation error:', error);
      dialog.showErrorBox('Installation Failed', 'Failed to install Ollama. Please install it manually from https://ollama.ai');
    }
  }
}

module.exports = SetupWizard; 