const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods for the setup wizard
contextBridge.exposeInMainWorld('electronAPI', {
  // Step management
  onStepUpdate: (callback) => {
    ipcRenderer.on('setup-step', (event, data) => callback(data));
  },
  
  // API key testing
  testApiKey: (apiKey) => ipcRenderer.invoke('test-api-key', apiKey),
  
  // Ollama installation
  installOllama: () => ipcRenderer.invoke('install-ollama'),
  
  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Setup completion
  finishSetup: () => ipcRenderer.invoke('finish-setup'),
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
}); 