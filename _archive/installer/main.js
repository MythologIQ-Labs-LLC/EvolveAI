const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// GitHub repository configuration
const GITHUB_REPO = 'WulfForge/EvolveAI';
const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;
const GITHUB_ISSUES_URL = `${GITHUB_URL}/issues`;
const GITHUB_RELEASES_URL = `${GITHUB_URL}/releases`;

let mainWindow;
let updateWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    icon: path.join(__dirname, 'assets/evolveai-icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    titleBarStyle: 'default',
    autoHideMenuBar: false
  });

  // Load the Next.js app
  const isDev = process.env.NODE_ENV === 'development';
  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, 'app/index.html')}`;

  mainWindow.loadURL(startUrl);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Check for updates on startup
    if (!isDev) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Create application menu
  createApplicationMenu();
}

function createApplicationMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Conversation',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-action', 'new-conversation');
          }
        },
        {
          label: 'Open Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send('menu-action', 'open-settings');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => {
            checkForUpdates();
          }
        },
        {
          label: 'View Documentation',
          click: () => {
            shell.openExternal(`${GITHUB_URL}/blob/main/README.md`);
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            reportIssue();
          }
        },
        {
          label: 'View on GitHub',
          click: () => {
            shell.openExternal(GITHUB_URL);
          }
        },
        { type: 'separator' },
        {
          label: 'About EvolveAI',
          click: () => {
            showAboutDialog();
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function checkForUpdates() {
  log.info('Checking for updates...');
  
  // Show update checking dialog
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Checking for Updates',
    message: 'Checking for updates...',
    detail: 'Please wait while we check for the latest version of EvolveAI.'
  });

  autoUpdater.checkForUpdatesAndNotify();
}

function reportIssue() {
  const issueUrl = `${GITHUB_ISSUES_URL}/new?template=bug_report.md&title=Bug%20Report%20-%20EvolveAI%20v${app.getVersion()}`;
  
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Report Issue',
    message: 'Report Issue on GitHub',
    detail: 'This will open the GitHub Issues page where you can report bugs, request features, or ask questions.',
    buttons: ['Open GitHub', 'Cancel'],
    defaultId: 0
  }).then((result) => {
    if (result.response === 0) {
      shell.openExternal(issueUrl);
    }
  });
}

function showAboutDialog() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About EvolveAI',
    message: 'EvolveAI - Advanced AI Desktop Application',
    detail: `Version: ${app.getVersion()}\n\nA comprehensive desktop application that integrates conversational AI, vector memory, Google Workspace APIs, and custom API support for unlimited extensibility and multi-way AI conversations.\n\n© 2024 WulfForge. All rights reserved.`,
    buttons: ['View on GitHub', 'Close'],
    defaultId: 1
  }).then((result) => {
    if (result.response === 0) {
      shell.openExternal(GITHUB_URL);
    }
  });
}

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
  log.info('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  log.info('Update available:', info);
  
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Available',
    message: 'A new version of EvolveAI is available!',
    detail: `Version ${info.version} is ready to download and install.`,
    buttons: ['Download Update', 'Later'],
    defaultId: 0
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });
});

autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available:', info);
  
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'No Updates Available',
    message: 'You are running the latest version of EvolveAI!',
    detail: 'No updates are currently available.'
  });
});

autoUpdater.on('error', (err) => {
  log.error('AutoUpdater error:', err);
  
  dialog.showMessageBox(mainWindow, {
    type: 'error',
    title: 'Update Error',
    message: 'Failed to check for updates',
    detail: err.message
  });
});

autoUpdater.on('download-progress', (progressObj) => {
  log.info('Download progress:', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded:', info);
  
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: 'Update downloaded successfully!',
    detail: 'The update will be installed when you restart EvolveAI.',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

// IPC handlers for renderer process communication
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('check-for-updates', () => {
  return autoUpdater.checkForUpdatesAndNotify();
});

ipcMain.handle('open-github', () => {
  shell.openExternal(GITHUB_URL);
});

ipcMain.handle('open-issues', () => {
  shell.openExternal(GITHUB_ISSUES_URL);
});

ipcMain.handle('open-releases', () => {
  shell.openExternal(GITHUB_RELEASES_URL);
});

ipcMain.handle('get-system-info', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: process.version,
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron
  };
});

// App event handlers
app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle second instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
}); 