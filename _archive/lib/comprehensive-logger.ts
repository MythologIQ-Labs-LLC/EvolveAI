// Comprehensive logging system for EvolveAI with GitHub issue integration
import fs from 'fs';
import path from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export enum LogCategory {
  APPLICATION = 'APP',
  INSTALLATION = 'INSTALL',
  LOCAL_LLM = 'LLM',
  POST_INSTALL = 'POST_INSTALL',
  GITHUB = 'GITHUB',
  SYSTEM = 'SYSTEM',
  USER = 'USER',
  API = 'API',
  VOICE = 'VOICE',
  SETTINGS = 'SETTINGS'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: any;
  error?: Error;
  stack?: string;
  sessionId?: string;
  userId?: string;
  component?: string;
}

export interface GitHubIssueData {
  title: string;
  body: string;
  labels: string[];
  assignees?: string[];
  milestone?: number;
}

class ComprehensiveLogger {
  private logDir: string;
  private logFiles: Map<LogCategory, string> = new Map();
  private maxLogSize = 10 * 1024 * 1024; // 10MB
  private maxLogFiles = 5;
  private sessionId: string;
  private githubRepo = 'WulfForge/EvolveAI';
  private githubIssuesUrl = `https://github.com/${this.githubRepo}/issues/new`;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeLogDirectory();
    this.initializeLogFiles();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeLogDirectory(): void {
    this.logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private initializeLogFiles(): void {
    // Initialize log files for each category
    Object.values(LogCategory).forEach(category => {
      const fileName = `evolveai-${category.toLowerCase()}.log`;
      const filePath = path.join(this.logDir, fileName);
      this.logFiles.set(category, filePath);
      
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '');
      }
    });

    // Special files
    this.logFiles.set(LogCategory.APPLICATION, path.join(this.logDir, 'evolveai.log'));
    this.logFiles.set(LogCategory.SYSTEM, path.join(this.logDir, 'evolveai-errors.log'));
  }

  private rotateLogFile(filePath: string): void {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > this.maxLogSize) {
        // Rotate existing files
        for (let i = this.maxLogFiles - 1; i >= 1; i--) {
          const oldFile = `${filePath}.${i}`;
          const newFile = `${filePath}.${i + 1}`;
          if (fs.existsSync(oldFile)) {
            fs.renameSync(oldFile, newFile);
          }
        }
        
        // Move current file to .1
        fs.renameSync(filePath, `${filePath}.1`);
        fs.writeFileSync(filePath, '');
      }
    } catch (error) {
      console.error('Log rotation failed:', error);
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const levelStr = LogLevel[entry.level];
    const timestamp = entry.timestamp;
    const category = entry.category;
    const message = entry.message;
    
    let logLine = `[${timestamp}] [${levelStr}] [${category}] [${this.sessionId}] ${message}`;
    
    if (entry.component) {
      logLine += ` [Component: ${entry.component}]`;
    }
    
    if (entry.data) {
      logLine += ` | Data: ${JSON.stringify(entry.data, null, 2)}`;
    }
    
    if (entry.error) {
      logLine += ` | Error: ${entry.error.message}`;
      if (entry.stack) {
        logLine += ` | Stack: ${entry.stack}`;
      }
    }
    
    return logLine + '\n';
  }

  private writeLog(entry: LogEntry): void {
    try {
      const logLine = this.formatLogEntry(entry);
      
      // Write to category-specific log file
      const categoryFile = this.logFiles.get(entry.category);
      if (categoryFile) {
        this.rotateLogFile(categoryFile);
        fs.appendFileSync(categoryFile, logLine, 'utf8');
      }
      
      // Write errors to main error log
      if (entry.level >= LogLevel.ERROR) {
        const errorFile = this.logFiles.get(LogCategory.SYSTEM);
        if (errorFile) {
          this.rotateLogFile(errorFile);
          fs.appendFileSync(errorFile, logLine, 'utf8');
        }
      }
      
      // Also log to console in development
      if (process.env.NODE_ENV === 'development') {
        const consoleMethod = entry.level === LogLevel.ERROR ? 'error' : 
                             entry.level === LogLevel.WARN ? 'warn' : 
                             entry.level === LogLevel.DEBUG ? 'debug' : 'log';
        console[consoleMethod](logLine.trim());
      }
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  // Application Logging
  public appInfo(message: string, data?: any, component?: string): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      category: LogCategory.APPLICATION,
      message,
      data,
      component,
      sessionId: this.sessionId
    });
  }

  public appError(message: string, error?: Error, data?: any, component?: string): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      category: LogCategory.APPLICATION,
      message,
      error,
      data,
      component,
      sessionId: this.sessionId
    });
  }

  // Installation Logging
  public installInfo(message: string, data?: any, component?: string): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      category: LogCategory.INSTALLATION,
      message,
      data,
      component,
      sessionId: this.sessionId
    });
  }

  public installError(message: string, error?: Error, data?: any, component?: string): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      category: LogCategory.INSTALLATION,
      message,
      error,
      data,
      component,
      sessionId: this.sessionId
    });
  }

  // Local LLM Logging
  public llmInfo(message: string, data?: any, component?: string): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      category: LogCategory.LOCAL_LLM,
      message,
      data,
      component,
      sessionId: this.sessionId
    });
  }

  public llmError(message: string, error?: Error, data?: any, component?: string): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      category: LogCategory.LOCAL_LLM,
      message,
      error,
      data,
      component,
      sessionId: this.sessionId
    });
  }

  // Post-Install Usage Logging
  public usageInfo(message: string, data?: any, component?: string): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      category: LogCategory.POST_INSTALL,
      message,
      data,
      component,
      sessionId: this.sessionId
    });
  }

  public usageError(message: string, error?: Error, data?: any, component?: string): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      category: LogCategory.POST_INSTALL,
      message,
      error,
      data,
      component,
      sessionId: this.sessionId
    });
  }

  // GitHub Issue Integration
  public async createGitHubIssue(error: Error, context: any, category: LogCategory): Promise<string> {
    try {
      const issueData: GitHubIssueData = {
        title: `[${category}] ${error.message}`,
        body: this.generateIssueBody(error, context, category),
        labels: ['bug', 'auto-reported', category.toLowerCase()],
        assignees: ['WulfForge']
      };

      // Log the issue creation attempt
      this.writeLog({
        timestamp: new Date().toISOString(),
        level: LogLevel.INFO,
        category: LogCategory.GITHUB,
        message: 'Creating GitHub issue for error',
        data: issueData,
        component: 'GitHubIntegration'
      });

      // For now, return the URL with pre-filled data
      // In a real implementation, this would use GitHub API
      const issueUrl = `${this.githubIssuesUrl}?title=${encodeURIComponent(issueData.title)}&body=${encodeURIComponent(issueData.body)}&labels=${issueData.labels.join(',')}`;
      
      return issueUrl;
    } catch (error) {
      console.error('Failed to create GitHub issue:', error);
      return this.githubIssuesUrl;
    }
  }

  private generateIssueBody(error: Error, context: any, category: LogCategory): string {
    const systemInfo = this.getSystemInfo();
    const logFiles = this.getLogFilePaths();
    
    return `## Error Report

**Category:** ${category}
**Error:** ${error.message}
**Stack Trace:** \`\`\`${error.stack}\`\`\`

**Context:**
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

**System Information:**
- OS: ${systemInfo.os}
- Node.js: ${systemInfo.nodeVersion}
- Architecture: ${systemInfo.architecture}
- Memory: ${systemInfo.memory}GB
- Disk Space: ${systemInfo.diskSpace}GB

**Session ID:** ${this.sessionId}
**Timestamp:** ${new Date().toISOString()}

**Log Files:**
${logFiles.map(file => `- ${file}`).join('\n')}

**Steps to Reproduce:**
1. [Please describe the steps that led to this error]

**Expected Behavior:**
[Please describe what you expected to happen]

**Additional Notes:**
[Any additional information that might be helpful]

---
*This issue was automatically generated by EvolveAI's error reporting system.*`;
  }

  private getSystemInfo(): any {
    return {
      os: process.platform,
      nodeVersion: process.version,
      architecture: process.arch,
      memory: Math.round(require('os').totalmem() / 1024 / 1024 / 1024),
      diskSpace: 0 // Would need to implement disk space check
    };
  }

  private getLogFilePaths(): string[] {
    return Array.from(this.logFiles.values());
  }

  // Error reporting with user prompt
  public async reportErrorToUser(error: Error, context: any, category: LogCategory): Promise<void> {
    const issueUrl = await this.createGitHubIssue(error, context, category);
    
    // Log the error
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      category,
      message: 'Error reported to user with GitHub issue link',
      error,
      data: { issueUrl, context },
      component: 'ErrorReporting'
    });

    // In a real implementation, this would show a user-friendly dialog
    console.error(`
🚨 ERROR DETECTED

An error has occurred in EvolveAI. To help us fix this issue, please:

1. Click the link below to report this issue on GitHub
2. Include any additional details about what you were doing
3. Attach the relevant log files if requested

GitHub Issue Link: ${issueUrl}

Log Files Location: ${this.logDir}

Thank you for helping improve EvolveAI!
    `);
  }

  // Utility methods
  public getLogs(category?: LogCategory, level?: LogLevel, limit: number = 100): LogEntry[] {
    try {
      const targetCategory = category || LogCategory.APPLICATION;
      const logFile = this.logFiles.get(targetCategory);
      
      if (!logFile || !fs.existsSync(logFile)) {
        return [];
      }

      const logContent = fs.readFileSync(logFile, 'utf8');
      const lines = logContent.split('\n').filter(line => line.trim());
      
      const logs: LogEntry[] = [];
      for (const line of lines.reverse()) {
        if (logs.length >= limit) break;
        
        try {
          // Parse log line
          const match = line.match(/\[(.*?)\] \[(.*?)\] \[(.*?)\] \[(.*?)\] (.*)/);
          if (match) {
            const [, timestamp, levelStr, categoryStr, sessionId, message] = match;
            const logLevel = LogLevel[levelStr as keyof typeof LogLevel];
            
            if (!level || logLevel >= level) {
              logs.push({
                timestamp,
                level: logLevel,
                category: categoryStr as LogCategory,
                message,
                sessionId
              });
            }
          }
        } catch (parseError) {
          // Skip malformed lines
        }
      }
      
      return logs;
    } catch (error) {
      console.error('Failed to read logs:', error);
      return [];
    }
  }

  public clearLogs(category?: LogCategory): void {
    try {
      if (category) {
        const logFile = this.logFiles.get(category);
        if (logFile) {
          fs.writeFileSync(logFile, '');
        }
      } else {
        // Clear all log files
        this.logFiles.forEach(filePath => {
          fs.writeFileSync(filePath, '');
        });
      }
      
      this.appInfo('Logs cleared', { category });
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  public getLogStats(): { totalLines: number; errorCount: number; lastError?: string; categories: Record<string, number> } {
    try {
      let totalLines = 0;
      let errorCount = 0;
      let lastError: string | undefined;
      const categories: Record<string, number> = {};

      this.logFiles.forEach((filePath, category) => {
        if (fs.existsSync(filePath)) {
          const logContent = fs.readFileSync(filePath, 'utf8');
          const lines = logContent.split('\n').filter(line => line.trim());
          
          categories[category] = lines.length;
          totalLines += lines.length;
          
          // Count errors in this category
          const errorLines = lines.filter(line => line.includes('[ERROR]') || line.includes('[FATAL]'));
          errorCount += errorLines.length;
          
          if (errorLines.length > 0 && !lastError) {
            lastError = errorLines[errorLines.length - 1];
          }
        }
      });
      
      return {
        totalLines,
        errorCount,
        lastError,
        categories
      };
    } catch (error) {
      return { totalLines: 0, errorCount: 0, categories: {} };
    }
  }
}

// Singleton instance
export const comprehensiveLogger = new ComprehensiveLogger();

// Convenience functions
export const log = {
  // Application logging
  appInfo: (message: string, data?: any, component?: string) => comprehensiveLogger.appInfo(message, data, component),
  appError: (message: string, error?: Error, data?: any, component?: string) => comprehensiveLogger.appError(message, error, data, component),
  
  // Installation logging
  installInfo: (message: string, data?: any, component?: string) => comprehensiveLogger.installInfo(message, data, component),
  installError: (message: string, error?: Error, data?: any, component?: string) => comprehensiveLogger.installError(message, error, data, component),
  
  // Local LLM logging
  llmInfo: (message: string, data?: any, component?: string) => comprehensiveLogger.llmInfo(message, data, component),
  llmError: (message: string, error?: Error, data?: any, component?: string) => comprehensiveLogger.llmError(message, error, data, component),
  
  // Usage logging
  usageInfo: (message: string, data?: any, component?: string) => comprehensiveLogger.usageInfo(message, data, component),
  usageError: (message: string, error?: Error, data?: any, component?: string) => comprehensiveLogger.usageError(message, error, data, component),
  
  // Error reporting
  reportError: (error: Error, context: any, category: LogCategory) => comprehensiveLogger.reportErrorToUser(error, context, category),
  
  // Utility functions
  getLogs: (category?: LogCategory, level?: LogLevel, limit?: number) => comprehensiveLogger.getLogs(category, level, limit),
  clearLogs: (category?: LogCategory) => comprehensiveLogger.clearLogs(category),
  getStats: () => comprehensiveLogger.getLogStats()
}; 