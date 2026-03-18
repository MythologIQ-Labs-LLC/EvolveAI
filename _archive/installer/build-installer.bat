@echo off
echo ========================================
echo EvolveAI Installer Build Script
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not installed or not in PATH
    pause
    exit /b 1
)

echo Building EvolveAI Installer...
echo.

REM Install dependencies
echo [1/5] Installing dependencies...
npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

REM Build the Next.js application
echo [2/5] Building Next.js application...
npm run build
if errorlevel 1 (
    echo ERROR: Failed to build Next.js application
    pause
    exit /b 1
)

REM Copy built files to installer directory
echo [3/5] Copying built files...
if exist "installer\app" rmdir /s /q "installer\app"
xcopy "out\*" "installer\app\" /e /i /y
if errorlevel 1 (
    echo ERROR: Failed to copy built files
    pause
    exit /b 1
)

REM Build the Electron application
echo [4/5] Building Electron application...
cd installer
npm run build:win
if errorlevel 1 (
    echo ERROR: Failed to build Electron application
    cd ..
    pause
    exit /b 1
)
cd ..

REM Create final installer
echo [5/5] Creating final installer...
if exist "dist" (
    echo Moving installer files to dist directory...
    if not exist "dist" mkdir "dist"
    move "installer\dist\*" "dist\" >nul 2>&1
)

echo.
echo ========================================
echo Build Complete!
echo ========================================
echo.
echo Installer files created in the 'dist' directory:
echo - EvolveAI-Setup.exe (NSIS installer)
echo - EvolveAI-Setup.msi (MSI installer)
echo.
echo You can now distribute these installer files.
echo.
pause 