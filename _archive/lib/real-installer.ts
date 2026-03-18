// Real Installation System for EvolveAI
// Actually downloads and installs software instead of just simulating

import { exec, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import * as http from 'http';

export interface InstallationProgress {
  stage: string;
  progress: number;
  message: string;
  error?: string;
}

export interface SystemRequirements {
  os: 'windows' | 'macos' | 'linux';
  architecture: 'x64' | 'arm64';
  ram: number; // GB
  diskSpace: number; // GB
  hasDocker: boolean;
  hasPostgreSQL: boolean;
  hasOllama: boolean;
}

export interface InstallationResult {
  success: boolean;
  error?: string;
  installedComponents: string[];
  systemInfo: SystemRequirements;
}

export class RealInstaller {
  private platform: string;
  private architecture: string;
  private tempDir: string;

  constructor() {
    this.platform = os.platform();
    this.architecture = os.arch();
    this.tempDir = os.tmpdir();
  }

  public async getSystemRequirements(): Promise<SystemRequirements> {
    const totalMem = Math.round(os.totalmem() / (1024 * 1024 * 1024)); // GB
    const freeDisk = await this.getFreeDiskSpace();
    
    return {
      os: this.platform as any,
      architecture: this.architecture as any,
      ram: totalMem,
      diskSpace: freeDisk,
      hasDocker: await this.checkDockerInstallation(),
      hasPostgreSQL: await this.checkPostgreSQLInstallation(),
      hasOllama: await this.checkOllamaInstallation()
    };
  }

  private async getFreeDiskSpace(): Promise<number> {
    return new Promise((resolve) => {
      if (this.platform === 'win32') {
        exec('wmic logicaldisk get size,freespace,caption', (error, stdout) => {
          if (error) {
            resolve(100); // Default fallback
            return;
          }
          
          const lines = stdout.trim().split('\n');
          let totalFree = 0;
          
          for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].trim().split(/\s+/);
            if (parts.length >= 3) {
              totalFree += parseInt(parts[1]) / (1024 * 1024 * 1024); // Convert to GB
            }
          }
          
          resolve(Math.round(totalFree));
        });
      } else {
        exec('df -BG / | tail -1 | awk \'{print $4}\'', (error, stdout) => {
          if (error) {
            resolve(100); // Default fallback
            return;
          }
          resolve(parseInt(stdout.trim()));
        });
      }
    });
  }

  private async checkDockerInstallation(): Promise<boolean> {
    return new Promise((resolve) => {
      exec('docker --version', (error) => {
        resolve(!error);
      });
    });
  }

  private async checkPostgreSQLInstallation(): Promise<boolean> {
    return new Promise((resolve) => {
      exec('psql --version', (error) => {
        resolve(!error);
      });
    });
  }

  private async checkOllamaInstallation(): Promise<boolean> {
    return new Promise((resolve) => {
      exec('ollama --version', (error) => {
        resolve(!error);
      });
    });
  }

  public async installOllama(progressCallback?: (progress: InstallationProgress) => void): Promise<InstallationResult> {
    try {
      progressCallback?.({
        stage: 'ollama',
        progress: 0,
        message: 'Starting Ollama installation...'
      });

      // Check if already installed
      if (await this.checkOllamaInstallation()) {
        progressCallback?.({
          stage: 'ollama',
          progress: 100,
          message: 'Ollama is already installed'
        });
        return { success: true, installedComponents: ['ollama'], systemInfo: await this.getSystemRequirements() };
      }

      progressCallback?.({
        stage: 'ollama',
        progress: 10,
        message: 'Downloading Ollama...'
      });

      const downloadUrl = this.getOllamaDownloadUrl();
      const downloadPath = await this.downloadFile(downloadUrl, 'ollama-installer');

      progressCallback?.({
        stage: 'ollama',
        progress: 50,
        message: 'Installing Ollama...'
      });

      await this.installOllamaBinary(downloadPath);

      progressCallback?.({
        stage: 'ollama',
        progress: 80,
        message: 'Starting Ollama service...'
      });

      await this.startOllamaService();

      progressCallback?.({
        stage: 'ollama',
        progress: 100,
        message: 'Ollama installed successfully!'
      });

      return { success: true, installedComponents: ['ollama'], systemInfo: await this.getSystemRequirements() };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      progressCallback?.({
        stage: 'ollama',
        progress: 0,
        message: 'Installation failed',
        error: errorMessage
      });
      return { success: false, error: errorMessage, installedComponents: [], systemInfo: await this.getSystemRequirements() };
    }
  }

  private getOllamaDownloadUrl(): string {
    if (this.platform === 'win32') {
      return 'https://ollama.ai/download/ollama-windows-amd64.msi';
    } else if (this.platform === 'darwin') {
      return this.architecture === 'arm64' 
        ? 'https://ollama.ai/download/ollama-darwin-arm64'
        : 'https://ollama.ai/download/ollama-darwin-amd64';
    } else {
      return this.architecture === 'arm64'
        ? 'https://ollama.ai/download/ollama-linux-arm64'
        : 'https://ollama.ai/download/ollama-linux-amd64';
    }
  }

  private async downloadFile(url: string, filename: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const filePath = path.join(this.tempDir, filename);
      const file = fs.createWriteStream(filePath);
      
      const request = url.startsWith('https:') ? https : http;
      
      request.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with status ${response.statusCode}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve(filePath);
        });
        
        file.on('error', (error) => {
          fs.unlink(filePath, () => {}); // Delete file on error
          reject(error);
        });
      }).on('error', (error) => {
        fs.unlink(filePath, () => {}); // Delete file on error
        reject(error);
      });
    });
  }

  private async installOllamaBinary(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.platform === 'win32') {
        exec(`msiexec /i "${filePath}" /quiet /norestart`, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      } else {
        // For macOS and Linux
        exec(`chmod +x "${filePath}" && sudo mv "${filePath}" /usr/local/bin/ollama`, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }
    });
  }

  private async startOllamaService(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.platform === 'win32') {
        exec('net start ollama', (error) => {
          if (error) {
            // Try to start manually
            exec('ollama serve', (error2) => {
              if (error2) {
                reject(error2);
              } else {
                resolve();
              }
            });
          } else {
            resolve();
          }
        });
      } else {
        exec('ollama serve &', (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }
    });
  }

  public async installModel(modelName: string, progressCallback?: (progress: InstallationProgress) => void): Promise<InstallationResult> {
    try {
      progressCallback?.({
        stage: 'model',
        progress: 0,
        message: `Starting ${modelName} installation...`
      });

      return new Promise((resolve) => {
        const ollamaProcess = spawn('ollama', ['pull', modelName]);
        
        let progress = 0;
        
        ollamaProcess.stdout.on('data', (data) => {
          const output = data.toString();
          if (output.includes('pulling')) {
            progress += 10;
            progressCallback?.({
              stage: 'model',
              progress: Math.min(progress, 90),
              message: `Downloading ${modelName}... ${progress}%`
            });
          }
        });
        
        ollamaProcess.stderr.on('data', (data) => {
          console.error(`Ollama error: ${data}`);
        });
        
        ollamaProcess.on('close', (code) => {
          this.getSystemRequirements().then(systemInfo => {
            if (code === 0) {
              progressCallback?.({
                stage: 'model',
                progress: 100,
                message: `${modelName} installed successfully!`
              });
              resolve({ 
                success: true, 
                installedComponents: [modelName], 
                systemInfo
              });
            } else {
              progressCallback?.({
                stage: 'model',
                progress: 0,
                message: `Failed to install ${modelName}`,
                error: `Exit code: ${code}`
              });
              resolve({ 
                success: false, 
                error: `Failed to install ${modelName}`, 
                installedComponents: [], 
                systemInfo
              });
            }
          });
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      progressCallback?.({
        stage: 'model',
        progress: 0,
        message: 'Installation failed',
        error: errorMessage
      });
      return { success: false, error: errorMessage, installedComponents: [], systemInfo: await this.getSystemRequirements() };
    }
  }

  public async installDocker(progressCallback?: (progress: InstallationProgress) => void): Promise<InstallationResult> {
    try {
      progressCallback?.({
        stage: 'docker',
        progress: 0,
        message: 'Starting Docker installation...'
      });

      if (await this.checkDockerInstallation()) {
        progressCallback?.({
          stage: 'docker',
          progress: 100,
          message: 'Docker is already installed'
        });
        return { success: true, installedComponents: ['docker'], systemInfo: await this.getSystemRequirements() };
      }

      if (this.platform === 'win32') {
        // For Windows, direct users to download Docker Desktop
        progressCallback?.({
          stage: 'docker',
          progress: 50,
          message: 'Please download and install Docker Desktop from https://www.docker.com/products/docker-desktop'
        });
        
        // Open Docker Desktop download page
        exec('start https://www.docker.com/products/docker-desktop');
        
        return { success: false, error: 'Docker Desktop must be installed manually on Windows', installedComponents: [], systemInfo: await this.getSystemRequirements() };
      } else if (this.platform === 'darwin') {
        // For macOS, use Homebrew
        progressCallback?.({
          stage: 'docker',
          progress: 25,
          message: 'Installing Docker via Homebrew...'
        });

        exec('brew install --cask docker', (error) => {
          if (error) {
            progressCallback?.({
              stage: 'docker',
              progress: 0,
              message: 'Docker installation failed',
              error: error.message
            });
          } else {
            progressCallback?.({
              stage: 'docker',
              progress: 100,
              message: 'Docker installed successfully!'
            });
          }
        });
      } else {
        // For Linux, use package manager
        progressCallback?.({
          stage: 'docker',
          progress: 25,
          message: 'Installing Docker via package manager...'
        });

        exec('curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh', (error) => {
          if (error) {
            progressCallback?.({
              stage: 'docker',
              progress: 0,
              message: 'Docker installation failed',
              error: error.message
            });
          } else {
            progressCallback?.({
              stage: 'docker',
              progress: 100,
              message: 'Docker installed successfully!'
            });
          }
        });
      }

      return { success: true, installedComponents: ['docker'], systemInfo: await this.getSystemRequirements() };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      progressCallback?.({
        stage: 'docker',
        progress: 0,
        message: 'Installation failed',
        error: errorMessage
      });
      return { success: false, error: errorMessage, installedComponents: [], systemInfo: await this.getSystemRequirements() };
    }
  }

  public async installPostgreSQL(progressCallback?: (progress: InstallationProgress) => void): Promise<InstallationResult> {
    try {
      progressCallback?.({
        stage: 'postgresql',
        progress: 0,
        message: 'Starting PostgreSQL installation...'
      });

      if (await this.checkPostgreSQLInstallation()) {
        progressCallback?.({
          stage: 'postgresql',
          progress: 100,
          message: 'PostgreSQL is already installed'
        });
        return { success: true, installedComponents: ['postgresql'], systemInfo: await this.getSystemRequirements() };
      }

      if (this.platform === 'win32') {
        // For Windows, use Chocolatey or direct download
        progressCallback?.({
          stage: 'postgresql',
          progress: 25,
          message: 'Installing PostgreSQL via Chocolatey...'
        });

        exec('choco install postgresql', (error) => {
          if (error) {
            progressCallback?.({
              stage: 'postgresql',
              progress: 0,
              message: 'PostgreSQL installation failed',
              error: error.message
            });
          } else {
            progressCallback?.({
              stage: 'postgresql',
              progress: 100,
              message: 'PostgreSQL installed successfully!'
            });
          }
        });
      } else if (this.platform === 'darwin') {
        // For macOS, use Homebrew
        progressCallback?.({
          stage: 'postgresql',
          progress: 25,
          message: 'Installing PostgreSQL via Homebrew...'
        });

        exec('brew install postgresql@14 && brew services start postgresql@14', (error) => {
          if (error) {
            progressCallback?.({
              stage: 'postgresql',
              progress: 0,
              message: 'PostgreSQL installation failed',
              error: error.message
            });
          } else {
            progressCallback?.({
              stage: 'postgresql',
              progress: 100,
              message: 'PostgreSQL installed successfully!'
            });
          }
        });
      } else {
        // For Linux, use package manager
        progressCallback?.({
          stage: 'postgresql',
          progress: 25,
          message: 'Installing PostgreSQL via package manager...'
        });

        exec('sudo apt-get update && sudo apt-get install -y postgresql postgresql-contrib', (error) => {
          if (error) {
            progressCallback?.({
              stage: 'postgresql',
              progress: 0,
              message: 'PostgreSQL installation failed',
              error: error.message
            });
          } else {
            progressCallback?.({
              stage: 'postgresql',
              progress: 100,
              message: 'PostgreSQL installed successfully!'
            });
          }
        });
      }

      return { success: true, installedComponents: ['postgresql'], systemInfo: await this.getSystemRequirements() };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      progressCallback?.({
        stage: 'postgresql',
        progress: 0,
        message: 'Installation failed',
        error: errorMessage
      });
      return { success: false, error: errorMessage, installedComponents: [], systemInfo: await this.getSystemRequirements() };
    }
  }

  public async installAll(progressCallback?: (progress: InstallationProgress) => void): Promise<InstallationResult> {
    const installedComponents: string[] = [];
    const systemInfo = await this.getSystemRequirements();

    try {
      // Install Ollama
      const ollamaResult = await this.installOllama(progressCallback);
      if (ollamaResult.success) {
        installedComponents.push('ollama');
      }

      // Install Docker
      const dockerResult = await this.installDocker(progressCallback);
      if (dockerResult.success) {
        installedComponents.push('docker');
      }

      // Install PostgreSQL
      const postgresResult = await this.installPostgreSQL(progressCallback);
      if (postgresResult.success) {
        installedComponents.push('postgresql');
      }

      return {
        success: true,
        installedComponents,
        systemInfo: await this.getSystemRequirements()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      progressCallback?.({
        stage: 'all',
        progress: 0,
        message: 'Installation failed',
        error: errorMessage
      });
      return {
        success: false,
        error: errorMessage,
        installedComponents,
        systemInfo
      };
    }
  }
}

// Export singleton instance
export const realInstaller = new RealInstaller(); 