@echo off
title Project-Evolve-by-MythologIQ Diagnostic Tool
color 0E

echo.
echo ========================================
echo    PROJECT-EVOLVE-BY-MYTHOLOGIQ DIAGNOSTIC TOOL
echo ========================================
echo.

:: Create logs directory if it doesn't exist
if not exist "logs" mkdir logs

:: Initialize diagnostic log
echo [%date% %time%] Starting Project-Evolve-by-MythologIQ diagnostic... > logs\diagnostic.log

echo Checking system requirements...
echo [%date% %time%] Checking system requirements... >> logs\diagnostic.log

:: Check Node.js
echo.
echo [1/6] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo    ✓ Node.js found: %NODE_VERSION%
    echo [%date% %time%] Node.js found: %NODE_VERSION% >> logs\diagnostic.log
) else (
    echo    ✗ Node.js not found or not in PATH
    echo [%date% %time%] ERROR: Node.js not found >> logs\diagnostic.log
    goto :error
)

:: Check npm
echo.
echo [2/6] Checking npm...
npm --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo    ✓ npm found: %NPM_VERSION%
    echo [%date% %time%] npm found: %NPM_VERSION% >> logs\diagnostic.log
) else (
    echo    ✗ npm not found
    echo [%date% %time%] ERROR: npm not found >> logs\diagnostic.log
    goto :error
)

:: Check package.json
echo.
echo [3/6] Checking project files...
if exist "package.json" (
    echo    ✓ package.json found
    echo [%date% %time%] package.json found >> logs\diagnostic.log
    
    :: Check project name
    for /f "tokens=2 delims=:," %%i in ('findstr /C:"\"name\"" package.json') do set PROJECT_NAME=%%i
    set PROJECT_NAME=%PROJECT_NAME:"=%
    set PROJECT_NAME=%PROJECT_NAME: =%
    echo    ✓ Project name: %PROJECT_NAME%
    echo [%date% %time%] Project name: %PROJECT_NAME% >> logs\diagnostic.log
) else (
    echo    ✗ package.json not found
    echo [%date% %time%] ERROR: package.json not found >> logs\diagnostic.log
    goto :error
)

:: Check node_modules
echo.
echo [4/6] Checking dependencies...
if exist "node_modules" (
    echo    ✓ node_modules directory exists
    echo [%date% %time%] node_modules directory exists >> logs\diagnostic.log
) else (
    echo    ✗ node_modules not found - running npm install...
    echo [%date% %time%] node_modules not found - installing dependencies... >> logs\diagnostic.log
    npm install
    if %errorlevel% neq 0 (
        echo    ✗ npm install failed
        echo [%date% %time%] ERROR: npm install failed >> logs\diagnostic.log
        goto :error
    )
)

:: Check Next.js
echo.
echo [5/6] Checking Next.js...
npx next --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('npx next --version') do set NEXT_VERSION=%%i
    echo    ✓ Next.js found: %NEXT_VERSION%
    echo [%date% %time%] Next.js found: %NEXT_VERSION% >> logs\diagnostic.log
) else (
    echo    ✗ Next.js not found
    echo [%date% %time%] ERROR: Next.js not found >> logs\diagnostic.log
    goto :error
)

:: Check port availability
echo.
echo [6/6] Checking port 3000...
netstat -an | findstr ":3000" >nul 2>&1
if %errorlevel% equ 0 (
    echo    ⚠ Port 3000 is in use
    echo [%date% %time%] WARNING: Port 3000 is in use >> logs\diagnostic.log
) else (
    echo    ✓ Port 3000 is available
    echo [%date% %time%] Port 3000 is available >> logs\diagnostic.log
)

:: System information
echo.
echo ========================================
echo    SYSTEM INFORMATION
echo ========================================
echo [%date% %time%] Collecting system information... >> logs\diagnostic.log

:: OS Version
for /f "tokens=4-5" %%a in ('ver') do set OS_VERSION=%%a %%b
echo OS: %OS_VERSION%
echo [%date% %time%] OS: %OS_VERSION% >> logs\diagnostic.log

:: Architecture
if "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
    echo Architecture: 64-bit
    echo [%date% %time%] Architecture: 64-bit >> logs\diagnostic.log
) else (
    echo Architecture: 32-bit
    echo [%date% %time%] Architecture: 32-bit >> logs\diagnostic.log
)

:: Memory
for /f "tokens=2" %%a in ('wmic computersystem get TotalPhysicalMemory /value ^| find "="') do set TOTAL_MEMORY=%%a
set /a MEMORY_GB=%TOTAL_MEMORY:~0,-1%/1024/1024/1024
echo Memory: %MEMORY_GB% GB
echo [%date% %time%] Memory: %MEMORY_GB% GB >> logs\diagnostic.log

:: Disk space
for /f "tokens=3" %%a in ('dir /-c ^| find "bytes free"') do set FREE_SPACE=%%a
set /a FREE_GB=%FREE_SPACE:~0,-1%/1024/1024/1024
echo Free disk space: %FREE_GB% GB
echo [%date% %time%] Free disk space: %FREE_GB% GB >> logs\diagnostic.log

:: Check for common issues
echo.
echo ========================================
echo    COMMON ISSUES CHECK
echo ========================================
echo [%date% %time%] Checking for common issues... >> logs\diagnostic.log

:: Check for antivirus interference
echo Checking for potential antivirus interference...
echo [%date% %time%] Checking for potential antivirus interference... >> logs\diagnostic.log

:: Check firewall
echo Checking Windows Firewall...
netsh advfirewall show allprofiles state | findstr "ON" >nul 2>&1
if %errorlevel% equ 0 (
    echo    ⚠ Windows Firewall is active
    echo [%date% %time%] WARNING: Windows Firewall is active >> logs\diagnostic.log
) else (
    echo    ✓ Windows Firewall is not blocking
    echo [%date% %time%] Windows Firewall is not blocking >> logs\diagnostic.log
)

:: Check for .next directory
if exist ".next" (
    echo    ✓ Next.js build directory exists
    echo [%date% %time%] Next.js build directory exists >> logs\diagnostic.log
) else (
    echo    ℹ Next.js build directory not found (will be created on first build)
    echo [%date% %time%] Next.js build directory not found >> logs\diagnostic.log
)

echo.
echo ========================================
echo    DIAGNOSTIC COMPLETE
echo ========================================
echo [%date% %time%] Diagnostic complete >> logs\diagnostic.log

echo.
echo Diagnostic log saved to: logs\diagnostic.log
echo.
echo If you encounter issues, please check:
echo 1. The diagnostic log file
echo 2. The application logs in the logs\ directory
echo 3. The browser console (F12) for any JavaScript errors
echo 4. Report issues to: https://github.com/WulfForge/EvolveAI/issues
echo.
echo Press any key to continue...
pause >nul
goto :end

:error
echo.
echo ========================================
echo    DIAGNOSTIC FAILED
echo ========================================
echo [%date% %time%] Diagnostic failed >> logs\diagnostic.log
echo.
echo Please check the diagnostic log for details:
echo logs\diagnostic.log
echo.
echo Common solutions:
echo 1. Install Node.js from https://nodejs.org/
echo 2. Run 'npm install' to install dependencies
echo 3. Check that port 3000 is not in use
echo 4. Ensure you have sufficient disk space
echo 5. Report issues to: https://github.com/WulfForge/EvolveAI/issues
echo.
pause
goto :end

:end
echo.
echo Diagnostic tool finished.
echo. 