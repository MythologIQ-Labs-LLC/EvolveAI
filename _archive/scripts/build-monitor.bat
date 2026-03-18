@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    EvolveAI Build Monitor
echo ========================================
echo.

:: Set up environment
set PROJECT_DIR=%~dp0..
cd /d "%PROJECT_DIR%"

:: Create logs directory
if not exist "logs" mkdir logs

:: Set up logging
set LOG_FILE=logs\build-monitor.log
echo [%date% %time%] Starting EvolveAI build monitor > "%LOG_FILE%"

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
    call :log "Found %NODE_COUNT% Node.js processes, checking for hangs..."
    
    :: Kill processes that have been running too long
    for /f "tokens=2" %%i in ('tasklist /FI "IMAGENAME eq node.exe" /FO CSV ^| find "node.exe"') do (
        set "PID=%%i"
        set "PID=!PID:,=!"
        
        :: Check process start time (simplified check)
        wmic process where "ProcessId=!PID!" get CreationDate /format:list > temp.txt 2>nul
        find "CreationDate" temp.txt >nul
        if errorlevel 1 (
            call :log "Killing potentially hanging process PID: !PID!"
            taskkill /PID !PID! /F >nul 2>&1
        )
    )
    del temp.txt 2>nul
)
goto :eof

:: Main build monitoring loop
:startBuild
call :log "Starting automated build process..."

:: Clean up any existing processes
call :killHangingProcesses

:: Start the build
call :log "Running npm run build..."
start /B cmd /c "npm run build > logs\build-output.log 2>&1"

:: Monitor the build
set BUILD_START=%time%
set LAST_ACTIVITY=%time%
set TIMEOUT_COUNT=0
set MAX_TIMEOUTS=3

:monitorLoop
timeout /t 30 /nobreak >nul

:: Check if build is still running
call :isProcessRunning "node.exe"
if !PROCESS_RUNNING!==0 (
    call :log "Build process completed or stopped"
    goto :checkOutput
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
    goto :startElectronBuild
)

goto :monitorLoop

:restartBuild
call :log "Restarting build process..."
call :killHangingProcesses
timeout /t 5 /nobreak >nul
goto :startBuild

:checkOutput
call :log "Checking build output..."
if exist "logs\build-output.log" (
    findstr /C:"error" logs\build-output.log >nul
    if not errorlevel 1 (
        call :log "Build errors detected!"
        goto :handleError
    )
    
    findstr /C:"Ready" logs\build-output.log >nul
    if not errorlevel 1 (
        call :log "Next.js build completed successfully!"
        goto :startElectronBuild
    )
) else (
    call :log "No build output log found!"
    goto :handleError
)

:startElectronBuild
call :log "Starting Electron packaging..."
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
goto :startElectronBuild

:checkFinalOutput
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
            goto :handleError
        )
    ) else (
        call :log "Dist directory is empty"
        goto :handleError
    )
) else (
    call :log "Dist directory not found"
    goto :handleError
)

:handleError
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