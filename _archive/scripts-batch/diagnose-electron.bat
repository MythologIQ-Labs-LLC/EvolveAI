@echo off
title EvolveAI Electron Diagnostics
color 0E

echo.
echo ========================================
echo    EVOLVEAI ELECTRON DIAGNOSTICS
echo ========================================
echo.

:: Create logs directory if it doesn't exist
if not exist "logs" mkdir logs

:: Initialize diagnostic log
echo [%date% %time%] Electron diagnostics started > logs\electron-diagnostics.log

:: Check system requirements
echo [1/8] Checking System Requirements...
echo [%date% %time%] Checking system requirements >> logs\electron-diagnostics.log

:: Check Node.js version
echo Checking Node.js version...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed or not in PATH
    echo [%date% %time%] ERROR: Node.js not found >> logs\electron-diagnostics.log
    echo.
    echo SOLUTION: Install Node.js from https://nodejs.org/
    echo.
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo ✓ Node.js version: %NODE_VERSION%
    echo [%date% %time%] Node.js version: %NODE_VERSION% >> logs\electron-diagnostics.log
)

:: Check npm version
echo Checking npm version...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed or not in PATH
    echo [%date% %time%] ERROR: npm not found >> logs\electron-diagnostics.log
) else (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo ✓ npm version: %NPM_VERSION%
    echo [%date% %time%] npm version: %NPM_VERSION% >> logs\electron-diagnostics.log
)

:: Check dependencies
echo.
echo [2/8] Checking Dependencies...
echo [%date% %time%] Checking dependencies >> logs\electron-diagnostics.log

if not exist "node_modules" (
    echo ❌ node_modules not found
    echo [%date% %time%] ERROR: node_modules not found >> logs\electron-diagnostics.log
    echo.
    echo SOLUTION: Run 'npm install' to install dependencies
    echo.
    set /p install_choice="Would you like to install dependencies now? (y/n): "
    if /i "%install_choice%"=="y" (
        echo Installing dependencies...
        npm install
        if %errorlevel% neq 0 (
            echo ❌ Failed to install dependencies
            echo [%date% %time%] ERROR: npm install failed >> logs\electron-diagnostics.log
        ) else (
            echo ✓ Dependencies installed successfully
            echo [%date% %time%] Dependencies installed successfully >> logs\electron-diagnostics.log
        )
    )
) else (
    echo ✓ node_modules directory exists
    echo [%date% %time%] node_modules directory exists >> logs\electron-diagnostics.log
)

:: Check Electron installation
echo.
echo [3/8] Checking Electron Installation...
echo [%date% %time%] Checking Electron installation >> logs\electron-diagnostics.log

npx electron --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Electron is not properly installed
    echo [%date% %time%] ERROR: Electron not found >> logs\electron-diagnostics.log
    echo.
    echo SOLUTION: Run 'npm install electron --save-dev'
    echo.
    set /p install_electron="Would you like to install Electron now? (y/n): "
    if /i "%install_electron%"=="y" (
        echo Installing Electron...
        npm install electron --save-dev
        if %errorlevel% neq 0 (
            echo ❌ Failed to install Electron
            echo [%date% %time%] ERROR: Electron install failed >> logs\electron-diagnostics.log
        ) else (
            echo ✓ Electron installed successfully
            echo [%date% %time%] Electron installed successfully >> logs\electron-diagnostics.log
        )
    )
) else (
    for /f "tokens=*" %%i in ('npx electron --version') do set ELECTRON_VERSION=%%i
    echo ✓ Electron version: %ELECTRON_VERSION%
    echo [%date% %time%] Electron version: %ELECTRON_VERSION% >> logs\electron-diagnostics.log
)

:: Check required files
echo.
echo [4/8] Checking Required Files...
echo [%date% %time%] Checking required files >> logs\electron-diagnostics.log

if not exist "electron\main.js" (
    echo ❌ electron\main.js not found
    echo [%date% %time%] ERROR: electron\main.js not found >> logs\electron-diagnostics.log
) else (
    echo ✓ electron\main.js exists
    echo [%date% %time%] electron\main.js exists >> logs\electron-diagnostics.log
)

if not exist "electron\preload.js" (
    echo ❌ electron\preload.js not found
    echo [%date% %time%] ERROR: electron\preload.js not found >> logs\electron-diagnostics.log
) else (
    echo ✓ electron\preload.js exists
    echo [%date% %time%] electron\preload.js exists >> logs\electron-diagnostics.log
)

if not exist "package.json" (
    echo ❌ package.json not found
    echo [%date% %time%] ERROR: package.json not found >> logs\electron-diagnostics.log
) else (
    echo ✓ package.json exists
    echo [%date% %time%] package.json exists >> logs\electron-diagnostics.log
)

:: Check port availability
echo.
echo [5/8] Checking Port Availability...
echo [%date% %time%] Checking port availability >> logs\electron-diagnostics.log

netstat -an | findstr ":3000" >nul
if %errorlevel% equ 0 (
    echo ⚠️  Port 3000 is already in use
    echo [%date% %time%] WARNING: Port 3000 in use >> logs\electron-diagnostics.log
    echo.
    echo This might cause issues with the development server.
    echo Consider stopping other applications using port 3000.
    echo.
) else (
    echo ✓ Port 3000 is available
    echo [%date% %time%] Port 3000 is available >> logs\electron-diagnostics.log
)

:: Check build status
echo.
echo [6/8] Checking Build Status...
echo [%date% %time%] Checking build status >> logs\electron-diagnostics.log

if not exist ".next" (
    echo ⚠️  Next.js build not found
    echo [%date% %time%] WARNING: .next directory not found >> logs\electron-diagnostics.log
    echo.
    echo This is normal for first-time setup.
    echo The build will be created when you run the app.
    echo.
) else (
    echo ✓ Next.js build exists
    echo [%date% %time%] Next.js build exists >> logs\electron-diagnostics.log
)

:: Test basic Electron functionality
echo.
echo [7/8] Testing Basic Electron Functionality...
echo [%date% %time%] Testing basic Electron functionality >> logs\electron-diagnostics.log

echo Testing Electron startup...
timeout /t 2 /nobreak >nul

:: Try to start Electron with a simple test
echo [%date% %time%] Starting Electron test >> logs\electron-diagnostics.log
start /b cmd /c "timeout /t 5 /nobreak >nul && taskkill /f /im electron.exe >nul 2>&1"
npm run electron >nul 2>&1

if %errorlevel% neq 0 (
    echo ❌ Basic Electron test failed
    echo [%date% %time%] ERROR: Basic Electron test failed >> logs\electron-diagnostics.log
) else (
    echo ✓ Basic Electron functionality works
    echo [%date% %time%] Basic Electron functionality works >> logs\electron-diagnostics.log
)

:: Generate recommendations
echo.
echo [8/8] Generating Recommendations...
echo [%date% %time%] Generating recommendations >> logs\electron-diagnostics.log

echo.
echo ========================================
echo    DIAGNOSTIC RESULTS & RECOMMENDATIONS
echo ========================================
echo.

echo RECOMMENDED ACTIONS:
echo.
echo 1. For Development:
echo    - Use: npm run electron:dev
echo    - This starts both Next.js dev server and Electron
echo.
echo 2. For Production Testing:
echo    - Use: npm run build:electron
echo    - Then: npm run electron:start
echo.
echo 3. For Quick Testing:
echo    - Use: npm run electron
echo    - (Requires Next.js server to be running)
echo.
echo 4. If you encounter issues:
echo    - Check logs\electron-diagnostics.log
echo    - Run this diagnostic again
echo    - Report issues to: https://github.com/WulfForge/EvolveAI/issues
echo.

echo [%date% %time%] Diagnostics completed >> logs\electron-diagnostics.log
echo.
echo Diagnostics completed! Check logs\electron-diagnostics.log for details.
echo.
pause 