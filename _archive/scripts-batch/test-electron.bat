@echo off
title EvolveAI Electron Test
color 0B

echo.
echo ========================================
echo    EVOLVEAI ELECTRON LAUNCH TEST
echo ========================================
echo.

:: Check if Node.js is available
echo [1/5] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    pause
    exit /b 1
)
echo ✓ Node.js is available

:: Check if npm is available
echo [2/5] Checking npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed or not in PATH
    pause
    exit /b 1
)
echo ✓ npm is available

:: Check if dependencies are installed
echo [3/5] Checking dependencies...
if not exist "node_modules" (
    echo ERROR: node_modules not found. Run 'npm install' first.
    pause
    exit /b 1
)
echo ✓ Dependencies are installed

:: Check if Electron is available
echo [4/5] Checking Electron...
npx electron --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Electron is not available
    pause
    exit /b 1
)
echo ✓ Electron is available

:: Test Electron launch
echo [5/5] Testing Electron launch...
echo.
echo Starting Electron in test mode...
echo This will open the app briefly to test functionality.
echo.
echo Press Ctrl+C to stop the test when the app appears.
echo.

:: Set environment for test
set NODE_ENV=development

:: Start the test
timeout /t 3 /nobreak >nul
npm run electron

echo.
echo Test completed!
pause 