const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  testGoogleAPI: (apiKey) => ipcRenderer.invoke('test-google-api', apiKey),
  installOllama: () => ipcRenderer.invoke('install-ollama'),
  installModel: (modelName) => ipcRenderer.invoke('install-model', modelName),
  testVoice: (config) => ipcRenderer.invoke('test-voice', config),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  getRecommendedModels: () => ipcRenderer.invoke('get-recommended-models'),
  getPersonalityTemplates: () => ipcRenderer.invoke('get-personality-templates'),
  
  // Listen for progress updates
  onModelInstallProgress: (callback) => {
    ipcRenderer.on('model-install-progress', callback);
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
}); 