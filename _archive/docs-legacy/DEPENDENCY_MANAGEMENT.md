# EvolveAI Dependency & Lock File Management

## Overview

EvolveAI includes a comprehensive dependency management system to prevent lock file conflicts, resolve security vulnerabilities, and maintain a clean development environment.

## Common Issues

### 1. Lock File Conflicts
- **Problem**: Multiple lock files (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`)
- **Cause**: Using different package managers in the same project
- **Solution**: Use the provided management scripts

### 2. Security Vulnerabilities
- **Problem**: Outdated packages with known security issues
- **Cause**: Dependencies not updated regularly
- **Solution**: Automated security audits and fixes

### 3. Dependency Inconsistencies
- **Problem**: `node_modules` out of sync with lock files
- **Cause**: Manual modifications or partial updates
- **Solution**: Clean reinstallation

## Management Tools

### 1. Batch Script (`fix-lock-files.bat`)

**One-click solution** for lock file conflicts:

```bash
npm run fix:lockfiles
```

**What it does:**
- Removes conflicting lock files
- Cleans NPM cache
- Removes `node_modules` and `package-lock.json`
- Fresh dependency installation
- Security audit and fixes

### 2. PowerShell Script (`manage-dependencies.ps1`)

**Advanced dependency management** with multiple actions:

```bash
# Check for issues
npm run deps:check

# Fix lock file conflicts and security issues
npm run deps:fix

# Update dependencies (safe)
npm run deps:update

# Security audit only
npm run deps:audit

# Clean and reinstall
npm run deps:clean

# Show help
npm run deps:help
```

### 3. Direct PowerShell Commands

For advanced users:

```powershell
# Check only
.\manage-dependencies.ps1 check

# Fix with breaking changes
.\manage-dependencies.ps1 fix -Force

# Update with breaking changes
.\manage-dependencies.ps1 update -Force
```

## Quick Fixes

### Immediate Lock File Fix
```bash
npm run fix:lockfiles
```

### Check Current Status
```bash
npm run deps:check
```

### Fix Security Issues
```bash
npm run deps:fix
```

## Troubleshooting

### Lock File Conflicts

**Symptoms:**
- `EADDRINUSE` errors
- Inconsistent dependency versions
- Build failures
- "Cannot find module" errors

**Solution:**
```bash
npm run fix:lockfiles
```

### Security Vulnerabilities

**Symptoms:**
- `npm audit` shows vulnerabilities
- Security warnings in console
- Build warnings

**Solution:**
```bash
npm run deps:audit
npm run deps:fix
```

### Dependency Inconsistencies

**Symptoms:**
- Modules not found
- Version conflicts
- Unexpected behavior

**Solution:**
```bash
npm run deps:clean
```

## Best Practices

### 1. Use Only One Package Manager
- **Recommended**: npm (already configured)
- **Avoid**: Mixing npm, yarn, or pnpm

### 2. Regular Maintenance
```bash
# Weekly check
npm run deps:check

# Monthly update
npm run deps:update
```

### 3. Before Major Changes
```bash
# Clean state
npm run deps:clean

# Install fresh
npm install
```

### 4. After Pulling Changes
```bash
# Check for conflicts
npm run deps:check

# Fix if needed
npm run deps:fix
```

## Configuration Files

### Package.json Scripts
```json
{
  "deps:check": "powershell -ExecutionPolicy Bypass -File manage-dependencies.ps1 check",
  "deps:fix": "powershell -ExecutionPolicy Bypass -File manage-dependencies.ps1 fix",
  "deps:update": "powershell -ExecutionPolicy Bypass -File manage-dependencies.ps1 update",
  "deps:audit": "powershell -ExecutionPolicy Bypass -File manage-dependencies.ps1 audit",
  "deps:clean": "powershell -ExecutionPolicy Bypass -File manage-dependencies.ps1 clean",
  "fix:lockfiles": "fix-lock-files.bat"
}
```

### .gitignore Entries
```
# Lock files (keep only package-lock.json)
pnpm-lock.yaml
yarn.lock

# Dependencies
node_modules/

# Build outputs
.next/
dist/
out/
```

## Security Considerations

### 1. Regular Audits
- Run `npm run deps:audit` weekly
- Fix high and moderate severity issues immediately
- Review low severity issues monthly

### 2. Breaking Changes
- Test thoroughly after major updates
- Use `-Force` flag carefully
- Keep backups before major changes

### 3. Production Safety
- Never use `--force` in production
- Test all updates in development first
- Maintain dependency lock files in version control

## Common Commands Reference

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run deps:check` | Check for issues | Daily/Weekly |
| `npm run deps:fix` | Fix conflicts and security | When issues found |
| `npm run deps:update` | Update dependencies | Monthly |
| `npm run deps:audit` | Security audit | Weekly |
| `npm run deps:clean` | Clean reinstall | When inconsistent |
| `npm run fix:lockfiles` | One-click fix | Emergency |

## Support

If you encounter issues:

1. **Check the status**: `npm run deps:check`
2. **Try the fix**: `npm run deps:fix`
3. **Clean if needed**: `npm run deps:clean`
4. **Check documentation**: Review this file
5. **Report issues**: Include error messages and steps

## Integration with Port Management

The dependency management system works alongside the port reservation system:

```bash
# Full system check
npm run ports:check
npm run deps:check

# Full system fix
npm run ports:cleanup
npm run deps:fix
```

This ensures both port conflicts and dependency issues are resolved together. 