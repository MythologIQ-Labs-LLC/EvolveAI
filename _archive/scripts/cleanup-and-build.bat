@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    EvolveAI Cleanup and Build Monitor
echo ========================================
echo.

:: Set up environment
set PROJECT_DIR=%~dp0..
cd /d "%PROJECT_DIR%"

:: Create logs directory
if not exist "logs" mkdir logs

:: Set up logging
set LOG_FILE=logs\cleanup-build-monitor.log
echo [%date% %time%] Starting EvolveAI cleanup and build monitor > "%LOG_FILE%"

:: Function to log messages
:log
echo [%date% %time%] %~1
echo [%date% %time%] %~1 >> "%LOG_FILE%"
goto :eof

:: Function to check if process is running
:isProcessRunning
tasklist /FI "IMAGENAME eq %~1" 2>NUL | find /I /N "%~1">NUL
if "%ERRORLEVEL%"=="0" (
    set "PROCESS_RUNNING=1"
) else (
    set "PROCESS_RUNNING=0"
)
goto :eof

:: Function to kill hanging processes
:killHangingProcesses
call :log "Checking for hanging Node.js processes..."
tasklist /FI "IMAGENAME eq node.exe" /FO CSV | find /C "node.exe" > temp.txt
set /p NODE_COUNT=<temp.txt
del temp.txt

if %NODE_COUNT% GTR 0 (
    call :log "Found %NODE_COUNT% Node.js processes, killing them..."
    taskkill /F /IM node.exe >nul 2>&1
    call :log "All Node.js processes terminated"
)
goto :eof

:: Phase 1: Cleanup
:cleanup
call :log "=== PHASE 1: CLEANUP ==="
call :log "Removing accidental files from Cursor-LocalAI-Integration..."

:: Kill any running processes first
call :killHangingProcesses

:: Remove accidental files and directories
if exist "src" (
    call :log "Removing src directory (accidental Cursor-LocalAI files)..."
    rmdir /s /q "src" 2>nul
)

if exist "dist" (
    call :log "Removing dist directory (will be recreated)..."
    rmdir /s /q "dist" 2>nul
)

if exist ".next" (
    call :log "Removing .next directory (will be recreated)..."
    rmdir /s /q ".next" 2>nul
)

:: Clean up any other accidental files
if exist "build-evolveai.bat" (
    call :log "Removing build-evolveai.bat (not needed)..."
    del "build-evolveai.bat" 2>nul
)

call :log "Cleanup completed successfully"
goto :verify

:: Phase 2: Verify Clean State
:verify
call :log "=== PHASE 2: VERIFY CLEAN STATE ==="

:: Check for essential EvolveAI files
set MISSING_FILES=0

if not exist "package.json" (
    call :log "ERROR: package.json missing!"
    set /a MISSING_FILES+=1
)

if not exist "app" (
    call :log "ERROR: app directory missing!"
    set /a MISSING_FILES+=1
)

if not exist "components" (
    call :log "ERROR: components directory missing!"
    set /a MISSING_FILES+=1
)

if not exist "lib" (
    call :log "ERROR: lib directory missing!"
    set /a MISSING_FILES+=1
)

if %MISSING_FILES% GTR 0 (
    call :log "ERROR: %MISSING_FILES% essential files missing! Cannot proceed."
    goto :error
)

call :log "Clean state verified - all essential EvolveAI files present"
goto :build

:: Phase 3: Build
:build
call :log "=== PHASE 3: BUILD ==="
call :log "Starting Next.js build..."

:: Start the build
start /B cmd /c "npm run build > logs\build-output.log 2>&1"

:: Monitor the build
set BUILD_START=%time%
set LAST_ACTIVITY=%time%
set TIMEOUT_COUNT=0
set MAX_TIMEOUTS=3

:buildMonitorLoop
timeout /t 30 /nobreak >nul

:: Check if build is still running
call :isProcessRunning "node.exe"
if !PROCESS_RUNNING!==0 (
    call :log "Build process completed or stopped"
    goto :checkBuildOutput
)

:: Check for build output activity
for %%f in (logs\build-output.log) do (
    set "LAST_MODIFIED=%%~tf"
)

:: Simple activity check (file modification time)
if not "!LAST_MODIFIED!"=="!LAST_ACTIVITY!" (
    set LAST_ACTIVITY=!LAST_MODIFIED!
    set TIMEOUT_COUNT=0
    call :log "Build activity detected - continuing..."
) else (
    set /a TIMEOUT_COUNT+=1
    call :log "No build activity detected (timeout !TIMEOUT_COUNT!/!MAX_TIMEOUTS!)"
    
    if !TIMEOUT_COUNT! GEQ !MAX_TIMEOUTS! (
        call :log "Build appears to be hanging - attempting recovery..."
        call :killHangingProcesses
        goto :restartBuild
    )
)

:: Check for completion indicators
findstr /C:"Ready" logs\build-output.log >nul
if not errorlevel 1 (
    call :log "Build completion detected!"
    goto :electronBuild
)

goto :buildMonitorLoop

:restartBuild
call :log "Restarting build process..."
call :killHangingProcesses
timeout /t 5 /nobreak >nul
goto :build

:checkBuildOutput
call :log "Checking build output..."
if exist "logs\build-output.log" (
    findstr /C:"error" logs\build-output.log >nul
    if not errorlevel 1 (
        call :log "Build errors detected!"
        goto :error
    )
    
    findstr /C:"Ready" logs\build-output.log >nul
    if not errorlevel 1 (
        call :log "Next.js build completed successfully!"
        goto :electronBuild
    )
) else (
    call :log "No build output log found!"
    goto :error
)

:: Phase 4: Electron Build
:electronBuild
call :log "=== PHASE 4: ELECTRON BUILD ==="
call :log "Starting Electron packaging..."

:: Check if .next directory exists
if not exist ".next" (
    call :log "ERROR: .next directory not found after build!"
    goto :error
)

:: Start Electron build
start /B cmd /c "npx electron-builder --win > logs\electron-output.log 2>&1"

:: Monitor Electron build
set ELECTRON_START=%time%
set ELECTRON_TIMEOUT=0

:electronMonitorLoop
timeout /t 30 /nobreak >nul

:: Check if Electron process is running
call :isProcessRunning "node.exe"
if !PROCESS_RUNNING!==0 (
    call :log "Electron build process completed"
    goto :checkFinalOutput
)

:: Check for completion
findstr /C:"Done" logs\electron-output.log >nul
if not errorlevel 1 (
    call :log "Electron build completed successfully!"
    goto :checkFinalOutput
)

set /a ELECTRON_TIMEOUT+=1
if !ELECTRON_TIMEOUT! GEQ 10 (
    call :log "Electron build timeout - attempting recovery..."
    call :killHangingProcesses
    goto :restartElectronBuild
)

goto :electronMonitorLoop

:restartElectronBuild
call :log "Restarting Electron build..."
call :killHangingProcesses
timeout /t 5 /nobreak >nul
goto :electronBuild

:: Phase 5: Final Verification
:checkFinalOutput
call :log "=== PHASE 5: FINAL VERIFICATION ==="
call :log "Checking final build output..."

if exist "dist" (
    dir /b dist > temp.txt
    set /p DIST_CONTENTS=<temp.txt
    del temp.txt
    
    if not "!DIST_CONTENTS!"=="" (
        call :log "Build artifacts found in dist directory:"
        for %%f in (dist\*) do (
            call :log "  - %%~nxf"
        )
        
        :: Check for installer
        if exist "dist\*.exe" (
            call :log "SUCCESS: Installer created successfully!"
            call :log "Build completed successfully!"
            goto :success
        ) else (
            call :log "No installer found in dist directory"
            goto :error
        )
    ) else (
        call :log "Dist directory is empty"
        goto :error
    )
) else (
    call :log "Dist directory not found"
    goto :error
)

:error
call :log "Build failed - generating error report..."
echo Build Error Report > logs\build-error-report.txt
echo ================== >> logs\build-error-report.txt
echo Time: %date% %time% >> logs\build-error-report.txt
echo. >> logs\build-error-report.txt

if exist "logs\build-output.log" (
    echo Build Output: >> logs\build-error-report.txt
    type logs\build-output.log >> logs\build-error-report.txt
    echo. >> logs\build-error-report.txt
)

if exist "logs\electron-output.log" (
    echo Electron Output: >> logs\build-error-report.txt
    type logs\electron-output.log >> logs\build-error-report.txt
)

call :log "Error report saved to logs\build-error-report.txt"
call :log "Build failed!"
pause
exit /b 1

:success
call :log "========================================"
call :log "    BUILD COMPLETED SUCCESSFULLY!"
call :log "========================================"
call :log "Installer is ready in the dist directory"
call :log "You can now distribute EvolveAI!"
echo.
pause
exit /b 0 