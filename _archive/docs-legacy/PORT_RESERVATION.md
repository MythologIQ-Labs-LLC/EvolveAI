# EvolveAI Port Reservation System

## Overview

EvolveAI now uses a dedicated port reservation system to prevent conflicts with other applications and ensure reliable operation.

## Reserved Port Range

**Ports 4000-4010** are reserved exclusively for EvolveAI:
- **Primary Port**: 4000 (preferred)
- **Fallback Range**: 4001-4010
- **Total Reserved**: 11 ports

## Why Port Reservation?

1. **Prevents Conflicts**: Avoids clashes with other development servers (React, Vue, etc.)
2. **Consistent Behavior**: App always uses the same port range
3. **Easier Debugging**: Predictable port usage
4. **Better User Experience**: No more "port already in use" errors

## Port Management Tools

### 1. PowerShell Script (`manage-ports.ps1`)

Advanced port management with multiple actions:

```bash
# Check port availability
npm run ports:check

# Reserve ports for EvolveAI
npm run ports:reserve

# Clean up EvolveAI processes
npm run ports:cleanup

# Show help
npm run ports:help
```

### 2. Batch Script (`cleanup-ports.bat`)

Simple cleanup for EvolveAI processes:

```bash
npm run cleanup
```

### 3. Registry File (`reserve-ports.reg`)

**Optional**: System-level port reservation (advanced users only)

⚠️ **Warning**: Registry modifications require administrator privileges and can affect system behavior.

## How It Works

### Automatic Port Detection
1. App starts and tries port 4000 first
2. If busy, tries 4001, then 4002, etc.
3. Fails if no ports available in range 4000-4010

### Process Cleanup
- Only targets Node.js and Electron processes
- Preserves system processes
- Cleans up on app exit

### Development vs Production
- **Development**: Uses `next dev -p 4000`
- **Production**: Dynamic port selection within reserved range

## Configuration Files

### Next.js Config (`next.config.mjs`)
```javascript
env: {
  PORT: process.env.PORT || '4000',
}
```

### Electron Main (`electron/main.js`)
```javascript
const RESERVED_PORTS = {
  START: 4000,
  END: 4010,
  PREFERRED: 4000
};
```

### Package.json Scripts
```json
{
  "dev": "next dev -p 4000",
  "start": "next start -p 4000",
  "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:4000 && electron .\""
}
```

## Troubleshooting

### Port Still in Use
1. Run `npm run ports:cleanup`
2. Check with `npm run ports:check`
3. Restart the application

### Permission Issues
- Run PowerShell as Administrator for registry operations
- Use `npm run ports:cleanup` instead of manual process killing

### System Conflicts
- Some antivirus software may interfere
- Corporate firewalls might block port ranges
- Check Windows Firewall settings

## Best Practices

1. **Always use the cleanup scripts** before starting development
2. **Check port availability** if experiencing connection issues
3. **Don't manually kill processes** - use the provided tools
4. **Keep the reserved range free** from other applications

## Customization

To change the reserved port range:

1. Update `RESERVED_PORTS` in `electron/main.js`
2. Modify port numbers in `package.json` scripts
3. Update `cleanup-ports.bat` port list
4. Change `manage-ports.ps1` `$ReservedPorts` array
5. Update `reserve-ports.reg` if using registry method

## Security Considerations

- Port reservation doesn't provide security isolation
- Use HTTPS in production environments
- Consider firewall rules for additional protection
- Registry modifications require careful consideration

## Support

If you encounter issues with the port reservation system:

1. Check this documentation
2. Run `npm run ports:help`
3. Review the troubleshooting section
4. Report issues with detailed error messages 