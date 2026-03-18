const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const { exec } = require('child_process');

// Keep a global reference of the window object
let mainWindow;
let nextProcess;
let devServerPort = 4000; // Reserved port for EvolveAI

// Development server URL and configuration
const isDev = process.env.NODE_ENV === 'development';

// Reserved port range for EvolveAI (4000-4010)
const RESERVED_PORTS = {
  START: 4000,
  END: 4010,
  PREFERRED: 4000
};

// Function to find available port within reserved range
async function findAvailablePort(startPort = RESERVED_PORTS.PREFERRED) {
  // First try the preferred port
  try {
    await new Promise((resolve, reject) => {
      const server = http.createServer();
      server.listen(startPort, () => {
        server.close();
        resolve(startPort);
      });
      server.on('error', reject);
    });
    return startPort;
  } catch (error) {
    // Preferred port is in use, try others in reserved range
    for (let port = RESERVED_PORTS.START; port <= RESERVED_PORTS.END; port++) {
      try {
        await new Promise((resolve, reject) => {
          const server = http.createServer();
          server.listen(port, () => {
            server.close();
            resolve(port);
          });
          server.on('error', reject);
        });
        return port;
      } catch (error) {
        // Port is in use, try next one
        continue;
      }
    }
    throw new Error(`No available ports found in reserved range ${RESERVED_PORTS.START}-${RESERVED_PORTS.END}`);
  }
}

// Function to kill processes on specific ports
function killProcessOnPort(port) {
  return new Promise((resolve) => {
    const platform = process.platform;
    let command;
    
    if (platform === 'win32') {
      command = `netstat -ano | findstr :${port}`;
    } else {
      command = `lsof -ti:${port}`;
    }
    
    exec(command, (error, stdout) => {
      if (error || !stdout) {
        resolve();
        return;
      }
      
      const lines = stdout.toString().trim().split('\n');
      const pids = new Set();
      
      lines.forEach(line => {
        if (platform === 'win32') {
          // Extract PID from Windows netstat output
          const match = line.match(/\s+(\d+)\s*$/);
          if (match) pids.add(match[1]);
        } else {
          // Extract PID from Unix lsof output
          const pid = line.trim();
          if (pid) pids.add(pid);
        }
      });
      
      if (pids.size === 0) {
        resolve();
        return;
      }
      
      // Kill processes
      const killCommand = platform === 'win32' 
        ? `taskkill /F /PID ${Array.from(pids).join(' /PID ')}`
        : `kill -9 ${Array.from(pids).join(' ')}`;
      
      exec(killCommand, (killError) => {
        if (killError) {
          console.log('Warning: Could not kill all processes on port', port);
        }
        resolve();
      });
    });
  });
}

// Server health check function
function checkServerHealth(url, timeout = 5000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(false);
    }, timeout);

    const req = http.get(url, (res) => {
      clearTimeout(timer);
      resolve(res.statusCode === 200);
    });

    req.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });

    req.setTimeout(timeout, () => {
      clearTimeout(timer);
      req.destroy();
      resolve(false);
    });
  });
}

// Wait for server to be ready
async function waitForServer(url, maxAttempts = 30, interval = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    console.log(`Checking server health (attempt ${i + 1}/${maxAttempts})...`);
    if (await checkServerHealth(url)) {
      console.log('Server is ready!');
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return false;
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    icon: path.join(__dirname, '../public/evolveai-icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true
    },
    show: false,
    titleBarStyle: 'default',
    autoHideMenuBar: false
  });

  // Load the app with better error handling
  loadApp();

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Open DevTools in development
    if (isDev) {
      mainWindow.webContents.openDevTools();
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

  // Handle page load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Page load failed:', errorCode, errorDescription);
    handleLoadError(errorCode, errorDescription);
  });

  // Create menu
  createMenu();
}

async function loadApp() {
  const url = isDev ? `http://localhost:${devServerPort}` : `http://localhost:${devServerPort}`;
  
  try {
    // Check if server is ready
    const serverReady = await waitForServer(url);
    
    if (!serverReady) {
      throw new Error('Server is not responding');
    }

    // Load the URL
    await mainWindow.loadURL(url);
    console.log('App loaded successfully');
  } catch (err) {
    console.error('Failed to load app:', err);
    handleLoadError(null, err.message);
  }
}

function handleLoadError(errorCode, errorDescription) {
  const errorMessage = `Failed to load application: ${errorDescription || 'Unknown error'}`;
  
  if (isDev) {
    console.error('Load error:', errorMessage);
    // In development, show error in console and try to reload
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.reload();
      }
    }, 2000);
  } else {
    dialog.showErrorBox('Load Error', errorMessage);
  }
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Conversation',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('new-conversation');
          }
        },
        {
          label: 'Open Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send('open-settings');
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
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About EvolveAI',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About EvolveAI',
              message: 'EvolveAI v1.0.0',
              detail: 'Advanced AI desktop application with hybrid architecture, multi-AI collaboration, and unlimited extensibility.\n\nBuilt by MythologIQ',
              buttons: ['OK']
            });
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/WulfForge/EvolveAI/issues/new');
          }
        },
        {
          label: 'View Documentation',
          click: () => {
            shell.openExternal('https://github.com/WulfForge/EvolveAI#readme');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Start Next.js server
async function startNextServer() {
  if (!isDev) {
    // For production, find an available port and start the server
    try {
      devServerPort = await findAvailablePort(4000);
      console.log(`Starting Next.js server on port ${devServerPort}`);
      
      const nextBin = path.join(__dirname, '../node_modules/.bin/next');
      const nextArgs = ['start', '-p', devServerPort.toString()];
      
      nextProcess = spawn(nextBin, nextArgs, {
        stdio: 'inherit',
        shell: true
      });

      nextProcess.on('error', (err) => {
        console.error('Failed to start Next.js server:', err);
      });
    } catch (error) {
      console.error('Failed to find available port:', error);
    }
  } else {
    // For development, try to detect the port from the running dev server
    for (let port = 4000; port < 4010; port++) {
      if (await checkServerHealth(`http://localhost:${port}`)) {
        devServerPort = port;
        console.log(`Detected Next.js dev server on port ${devServerPort}`);
        break;
      }
    }
  }
}

// App event handlers
app.whenReady().then(async () => {
  // Clean up any existing processes on our target ports
  console.log('Cleaning up existing processes...');
  await killProcessOnPort(4000);
  await killProcessOnPort(4001);
  await killProcessOnPort(4002);
  
  // Start the Next.js server
  await startNextServer();
  
  // Wait a bit for the server to start
  setTimeout(() => {
    createWindow();
  }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  console.log('Cleaning up processes before quit...');
  
  // Kill the Next.js process
  if (nextProcess) {
    nextProcess.kill();
  }
  
  // Kill any processes on our ports
  await killProcessOnPort(devServerPort);
  await killProcessOnPort(4000);
  await killProcessOnPort(4001);
  await killProcessOnPort(4002);
});

// Handle app quit
app.on('quit', async () => {
  console.log('App quitting, cleaning up...');
  
  // Final cleanup
  await killProcessOnPort(devServerPort);
  await killProcessOnPort(4000);
  await killProcessOnPort(4001);
  await killProcessOnPort(4002);
});

// Handle process termination
process.on('SIGINT', async () => {
  console.log('Received SIGINT, cleaning up...');
  await killProcessOnPort(devServerPort);
  await killProcessOnPort(4000);
  await killProcessOnPort(4001);
  await killProcessOnPort(4002);
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, cleaning up...');
  await killProcessOnPort(devServerPort);
  await killProcessOnPort(4000);
  await killProcessOnPort(4001);
  await killProcessOnPort(4002);
  process.exit(0);
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
});

ipcMain.handle('show-error-dialog', (event, title, content) => {
  return dialog.showErrorBox(title, content);
});

ipcMain.handle('show-message-box', (event, options) => {
  return dialog.showMessageBox(mainWindow, options);
});

// Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
}); 