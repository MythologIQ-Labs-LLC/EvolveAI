const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class BuildMonitor {
  constructor() {
    this.buildStartTime = Date.now();
    this.lastActivityTime = Date.now();
    this.maxBuildTime = 20 * 60 * 1000; // 20 minutes
    this.maxInactivityTime = 5 * 60 * 1000; // 5 minutes
    this.checkInterval = 30 * 1000; // 30 seconds
    this.buildProcess = null;
    this.isComplete = false;
    this.logFile = path.join(__dirname, '../logs/build-monitor.log');
    
    // Ensure log directory exists
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage.trim());
    fs.appendFileSync(this.logFile, logMessage);
  }

  startBuild() {
    this.log('🚀 Starting EvolveAI build process...');
    
    // Start the build process
    this.buildProcess = spawn('npm', ['run', 'build'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    // Monitor stdout
    this.buildProcess.stdout.on('data', (data) => {
      this.lastActivityTime = Date.now();
      const output = data.toString();
      this.log(`📊 Build Output: ${output.trim()}`);
      
      // Check for completion indicators
      if (output.includes('✓ Ready') || output.includes('Build completed')) {
        this.log('✅ Build completed successfully!');
        this.isComplete = true;
        this.startElectronBuild();
      }
    });

    // Monitor stderr
    this.buildProcess.stderr.on('data', (data) => {
      this.lastActivityTime = Date.now();
      const error = data.toString();
      this.log(`⚠️ Build Warning: ${error.trim()}`);
    });

    // Handle process exit
    this.buildProcess.on('exit', (code) => {
      if (code === 0) {
        this.log('✅ Next.js build process exited successfully');
        if (!this.isComplete) {
          this.startElectronBuild();
        }
      } else {
        this.log(`❌ Build process failed with code ${code}`);
        this.handleBuildFailure('Build process exited with non-zero code');
      }
    });

    // Handle process errors
    this.buildProcess.on('error', (error) => {
      this.log(`❌ Build process error: ${error.message}`);
      this.handleBuildFailure('Build process encountered an error');
    });

    // Start monitoring
    this.startMonitoring();
  }

  startElectronBuild() {
    this.log('🔧 Starting Electron packaging...');
    
    const electronProcess = spawn('npx', ['electron-builder', '--win'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    electronProcess.stdout.on('data', (data) => {
      this.lastActivityTime = Date.now();
      const output = data.toString();
      this.log(`📦 Electron Output: ${output.trim()}`);
      
      if (output.includes('Done') || output.includes('Built')) {
        this.log('🎉 Electron build completed successfully!');
        this.checkFinalOutput();
      }
    });

    electronProcess.stderr.on('data', (data) => {
      this.lastActivityTime = Date.now();
      const error = data.toString();
      this.log(`⚠️ Electron Warning: ${error.trim()}`);
    });

    electronProcess.on('exit', (code) => {
      if (code === 0) {
        this.log('✅ Electron build completed successfully');
        this.checkFinalOutput();
      } else {
        this.log(`❌ Electron build failed with code ${code}`);
        this.handleBuildFailure('Electron build failed');
      }
    });
  }

  startMonitoring() {
    const monitorInterval = setInterval(() => {
      const currentTime = Date.now();
      const buildDuration = currentTime - this.buildStartTime;
      const inactivityDuration = currentTime - this.lastActivityTime;

      // Check for timeout
      if (buildDuration > this.maxBuildTime) {
        this.log(`⏰ Build timeout reached (${this.maxBuildTime / 60000} minutes)`);
        this.handleBuildFailure('Build timeout');
        clearInterval(monitorInterval);
        return;
      }

      // Check for inactivity
      if (inactivityDuration > this.maxInactivityTime) {
        this.log(`😴 Build appears to be hanging (${this.maxInactivityTime / 60000} minutes of inactivity)`);
        this.handleBuildHang();
        clearInterval(monitorInterval);
        return;
      }

      // Log progress
      this.log(`⏱️ Build in progress... (${Math.floor(buildDuration / 60000)}m ${Math.floor((buildDuration % 60000) / 1000)}s)`);
      
      // Check for completion
      if (this.isComplete) {
        clearInterval(monitorInterval);
      }
    }, this.checkInterval);
  }

  handleBuildHang() {
    this.log('🔄 Attempting to recover from build hang...');
    
    // Kill the build process
    if (this.buildProcess) {
      this.buildProcess.kill('SIGTERM');
      setTimeout(() => {
        if (this.buildProcess) {
          this.buildProcess.kill('SIGKILL');
        }
      }, 5000);
    }

    // Clean up and restart
    this.cleanupAndRestart();
  }

  handleBuildFailure(reason) {
    this.log(`❌ Build failed: ${reason}`);
    
    // Kill the build process
    if (this.buildProcess) {
      this.buildProcess.kill('SIGTERM');
    }

    // Generate error report
    this.generateErrorReport(reason);
    
    process.exit(1);
  }

  cleanupAndRestart() {
    this.log('🧹 Cleaning up build artifacts...');
    
    // Remove partial build artifacts
    const cleanupPaths = ['.next', 'dist', 'out'];
    cleanupPaths.forEach(cleanupPath => {
      const fullPath = path.join(__dirname, '..', cleanupPath);
      if (fs.existsSync(fullPath)) {
        try {
          fs.rmSync(fullPath, { recursive: true, force: true });
          this.log(`🗑️ Cleaned up ${cleanupPath}`);
        } catch (error) {
          this.log(`⚠️ Failed to clean up ${cleanupPath}: ${error.message}`);
        }
      }
    });

    // Wait a moment and restart
    setTimeout(() => {
      this.log('🔄 Restarting build process...');
      this.startBuild();
    }, 2000);
  }

  checkFinalOutput() {
    this.log('🔍 Checking final build output...');
    
    const distPath = path.join(__dirname, '../dist');
    if (fs.existsSync(distPath)) {
      const files = fs.readdirSync(distPath);
      this.log(`📁 Found ${files.length} files in dist directory:`);
      files.forEach(file => {
        this.log(`   - ${file}`);
      });
      
      // Check for installer
      const installer = files.find(file => file.includes('.exe'));
      if (installer) {
        this.log(`🎉 SUCCESS: Installer created - ${installer}`);
        this.log('✅ Build completed successfully!');
        process.exit(0);
      } else {
        this.log('⚠️ No installer found in dist directory');
        this.handleBuildFailure('No installer generated');
      }
    } else {
      this.log('❌ Dist directory not found');
      this.handleBuildFailure('Dist directory not created');
    }
  }

  generateErrorReport(reason) {
    const reportPath = path.join(__dirname, '../logs/build-error-report.txt');
    const report = `
Build Error Report
==================
Time: ${new Date().toISOString()}
Reason: ${reason}
Duration: ${Math.floor((Date.now() - this.buildStartTime) / 60000)} minutes

System Info:
- Node.js: ${process.version}
- Platform: ${process.platform}
- Architecture: ${process.arch}

Build Log:
${fs.readFileSync(this.logFile, 'utf8')}
    `;
    
    fs.writeFileSync(reportPath, report);
    this.log(`📋 Error report saved to: ${reportPath}`);
  }
}

// Start the monitor
const monitor = new BuildMonitor();
monitor.startBuild(); 