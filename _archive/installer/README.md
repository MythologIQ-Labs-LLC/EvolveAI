# EvolveAI Installer System

This directory contains the complete installer system for EvolveAI, designed to provide a seamless installation experience on Windows systems.

## Overview

The EvolveAI installer system creates professional Windows installers (MSI and EXE) that handle:
- One-click installation with user-friendly wizard
- Automatic dependency management
- System integration (desktop shortcuts, start menu)
- Auto-update functionality
- GitHub integration for support and updates
- Comprehensive setup wizard for first-time configuration

## File Structure

```
installer/
├── package.json              # Installer dependencies and build configuration
├── main.js                   # Main Electron process for desktop app
├── preload.js                # Secure preload script for main process
├── setup-wizard.js           # Setup wizard logic
├── setup-wizard.html         # Setup wizard UI
├── setup-preload.js          # Preload script for setup wizard
├── nsis-installer.nsh        # NSIS installer script
├── build-installer.bat       # Windows build automation script
├── README.md                 # This documentation
└── assets/                   # Installer assets
    ├── icon.ico              # Application icon
    ├── welcome.bmp           # Welcome page image
    └── mythologiq-logo.png  # MythologIQ logo (PNG, for branding and about dialogs)
```

## Features

### 🚀 Easy Installation
- **Single File**: Download one EXE or MSI file
- **No Dependencies**: Everything included in the installer
- **Automatic Setup**: Handles all configuration automatically
- **Professional UI**: Modern installer interface with progress tracking

### 🔄 Auto-Updates
- **Automatic Checks**: Checks for updates on startup
- **GitHub Integration**: Direct integration with GitHub releases
- **Seamless Updates**: Downloads and installs updates automatically
- **Rollback Support**: Can revert to previous version if needed

### 🛠️ Setup Wizard
- **Guided Configuration**: Step-by-step setup process
- **API Key Management**: Easy Google AI Studio setup
- **Local LLM Installation**: Optional Ollama integration
- **Privacy Settings**: Configure data handling preferences
- **Smart Defaults**: Pre-configured for optimal experience

### 🔗 GitHub Integration
- **Direct Links**: Menu items link directly to GitHub
- **Issue Reporting**: One-click bug reporting
- **Documentation**: Links to comprehensive docs
- **Community**: Easy access to discussions and support

## Building the Installer

### Prerequisites

1. **Node.js** (v18 or higher)
2. **npm** (comes with Node.js)
3. **Windows 10/11** (for building Windows installers)

### Quick Build

Run the automated build script:

```bash
# Windows
build-installer.bat
```

### Manual Build

1. **Install dependencies**:
   ```bash
   npm install
   cd installer
   npm install
   cd ..
   ```

2. **Build Next.js app**:
   ```bash
   npm run build
   ```

3. **Copy built files**:
   ```bash
   xcopy "out\*" "installer\app\" /e /i /y
   ```

4. **Build installer**:
   ```bash
   cd installer
   npm run build:win
   cd ..
   ```

5. **Find installers**:
   - `installer/dist/EvolveAI-Setup.exe` (NSIS installer)
   - `installer/dist/EvolveAI-Setup.msi` (MSI installer)

## Installer Configuration

### Electron Builder Configuration

The `package.json` in the installer directory contains the Electron Builder configuration:

```json
{
  "build": {
    "appId": "com.evolveai.desktop",
    "productName": "EvolveAI",
    "win": {
      "target": [
        { "target": "nsis", "arch": ["x64"] },
        { "target": "msi", "arch": ["x64"] }
      ],
      "icon": "assets/icon.ico"
    }
  }
}
```

### NSIS Installer Script

The `nsis-installer.nsh` file contains the NSIS installer configuration with:

- **Professional UI**: Modern installer interface
- **System Integration**: Desktop shortcuts, start menu
- **Registry Entries**: Proper Windows integration
- **Uninstaller**: Complete removal capability
- **User Data**: Optional data preservation

## Setup Wizard

### Step 1: Welcome
- Application overview
- Feature highlights
- Setup process explanation

### Step 2: Google AI Studio Setup
- API key configuration
- Connection testing
- Free tier information
- Skip option for later setup

### Step 3: Local LLM Setup (Optional)
- Ollama installation
- Model selection
- Privacy benefits
- Manual installation option

### Step 4: Privacy & Updates
- Privacy mode configuration
- Auto-update settings
- Telemetry preferences
- Data handling information

### Step 5: Completion
- Setup summary
- Next steps guidance
- Quick links to resources
- Launch application option

## Auto-Update System

### Configuration

The auto-update system is configured in `main.js`:

```javascript
const { autoUpdater } = require('electron-updater');

// GitHub repository configuration
const GITHUB_REPO = 'WulfForge/EvolveAI';
const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;
```

### Update Process

1. **Check for Updates**: Automatic on startup, manual via menu
2. **Download**: Background download with progress tracking
3. **Install**: Automatic installation with user confirmation
4. **Restart**: Seamless application restart

### GitHub Integration

- **Releases**: Automatic detection of new releases
- **Issues**: Direct link to GitHub Issues
- **Documentation**: Links to README and docs
- **Community**: Access to discussions and support

## Security Features

### Code Signing
- **Digital Signature**: Installer is digitally signed
- **Trust**: Windows SmartScreen compatibility
- **Verification**: Automatic signature verification

### Sandboxing
- **Context Isolation**: Secure renderer process
- **Preload Scripts**: Controlled API exposure
- **IPC Security**: Secure inter-process communication

### Privacy
- **Local Storage**: All data stored locally
- **No Telemetry**: Zero data collection by default
- **Encrypted Keys**: API keys encrypted at rest
- **User Control**: Full control over data handling

## Distribution

### Release Process

1. **Build Installer**: Run build script
2. **Test Installation**: Verify on clean system
3. **Code Sign**: Sign installer with certificate
4. **Upload to GitHub**: Create release with installers
5. **Update Documentation**: Update download links

### File Sizes

- **EXE Installer**: ~150-200 MB (includes all dependencies)
- **MSI Installer**: ~150-200 MB (enterprise deployment)
- **Portable Version**: ~100 MB (no installation required)

### System Requirements

- **OS**: Windows 10 (version 1903) or later
- **Architecture**: x64 (64-bit)
- **RAM**: 4 GB minimum, 8 GB recommended
- **Storage**: 500 MB for installation, 2 GB for local models
- **Internet**: Required for initial setup and updates

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### Installation Issues
- **Admin Rights**: Installer requires administrator privileges
- **Antivirus**: May flag installer (add to exclusions)
- **Windows Defender**: May block installation (allow through)

#### Update Issues
- **Network**: Check internet connection
- **Firewall**: Allow EvolveAI through firewall
- **Proxy**: Configure proxy settings if needed

### Logs

Application logs are stored in:
- **Windows**: `%APPDATA%\EvolveAI\logs\`
- **Installation**: `%TEMP%\EvolveAI\logs\`

### Support

For installer issues:
1. Check the logs in the application data directory
2. Report issues on GitHub with log files
3. Include system information and error messages

## Customization

### Branding

To customize the installer:

1. **Icons**: Replace `assets/icon.ico`
2. **Images**: Replace `assets/welcome.bmp`
3. **Text**: Edit `nsis-installer.nsh`
4. **Colors**: Modify CSS in `setup-wizard.html`

### Configuration

To modify installer behavior:

1. **Electron Builder**: Edit `package.json` build section
2. **NSIS Script**: Modify `nsis-installer.nsh`
3. **Setup Wizard**: Edit `setup-wizard.js` and `setup-wizard.html`

### Localization

To add language support:

1. **NSIS**: Add language files to NSIS script
2. **Setup Wizard**: Create localized HTML files
3. **Application**: Use Next.js internationalization

## Best Practices

### Development
- **Test on Clean Systems**: Always test on fresh Windows installations
- **Version Management**: Use semantic versioning for releases
- **Code Signing**: Always sign installers for production
- **Documentation**: Keep documentation updated with changes

### Distribution
- **Multiple Formats**: Provide both EXE and MSI installers
- **Release Notes**: Include detailed release notes
- **System Requirements**: Clearly state minimum requirements
- **Support Information**: Provide clear support channels

### Security
- **Regular Updates**: Keep dependencies updated
- **Security Audits**: Regular security reviews
- **User Privacy**: Respect user privacy preferences
- **Data Protection**: Encrypt sensitive data

## License

This installer system is part of EvolveAI and follows the same license terms. See the main LICENSE file for details.

## Contributing

To contribute to the installer system:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

For major changes, please open an issue first to discuss the proposed changes. 