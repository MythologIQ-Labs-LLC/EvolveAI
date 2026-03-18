const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Dialogs
  showErrorDialog: (title, content) => ipcRenderer.invoke('show-error-dialog', title, content),
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  
  // App events
  onNewConversation: (callback) => ipcRenderer.on('new-conversation', callback),
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// Expose Node.js APIs that are safe for the renderer
contextBridge.exposeInMainWorld('nodeAPI', {
  // File system operations
  readFile: (filePath) => require('fs').readFileSync(filePath, 'utf8'),
  writeFile: (filePath, data) => require('fs').writeFileSync(filePath, data),
  exists: (filePath) => require('fs').existsSync(filePath),
  
  // Path operations
  join: (...paths) => require('path').join(...paths),
  dirname: (path) => require('path').dirname(path),
  basename: (path) => require('path').basename(path),
  
  // OS info
  platform: process.platform,
  arch: process.arch,
  version: process.version
});

// Expose environment variables
contextBridge.exposeInMainWorld('env', {
  NODE_ENV: process.env.NODE_ENV,
  ELECTRON_IS_DEV: process.env.NODE_ENV === 'development'
}); 