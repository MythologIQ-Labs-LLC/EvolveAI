@echo off
title Project-Evolve-by-MythologIQ Launcher
color 0A

:: Create logs directory if it doesn't exist
if not exist "logs" mkdir logs

:: Initialize launch log
echo [%date% %time%] Project-Evolve-by-MythologIQ Launcher started > logs\launcher.log

:: Auto-cleanup ports before starting
echo.
echo ========================================
echo    AUTOMATIC PORT CLEANUP
echo ========================================
echo [%date% %time%] Starting automatic port cleanup >> logs\launcher.log

:: Kill any existing EvolveAI Node.js and Electron processes (safer approach)
taskkill /F /IM electron.exe >nul 2>&1

:: Only kill Node.js processes that are likely EvolveAI-related
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO CSV ^| findstr /I "node.exe"') do (
    set pid=%%a
    set pid=!pid:"=!
    :: Check if this process is using our target ports
    netstat -ano | findstr "!pid!" | findstr ":300" >nul
    if !errorlevel! equ 0 (
        echo Found EvolveAI Node.js process !pid! - stopping...
        taskkill /F /PID !pid! >nul 2>&1
    )
)

:: Clean up specific ports but only for Node.js and Electron processes
for %%p in (3000 3001 3002 3003 3004 3005) do (
    for /f "tokens=1,5" %%a in ('netstat -ano ^| findstr :%%p 2^>nul') do (
        set pid=%%b
        if not "!pid!"=="" (
            tasklist /FI "PID eq !pid!" /FI "IMAGENAME eq node.exe" >nul 2>&1
            if !errorlevel! equ 0 (
                taskkill /F /PID !pid! >nul 2>&1
            ) else (
                tasklist /FI "PID eq !pid!" /FI "IMAGENAME eq electron.exe" >nul 2>&1
                if !errorlevel! equ 0 (
                    taskkill /F /PID !pid! >nul 2>&1
                )
            )
        )
    )
)

echo ✓ Safe port cleanup completed
echo [%date% %time%] Safe port cleanup completed >> logs\launcher.log

echo.
echo ========================================
echo    PROJECT-EVOLVE-BY-MYTHOLOGIQ LAUNCHER v1.0.0
echo ========================================
echo [%date% %time%] Launcher menu displayed >> logs\launcher.log
echo.
echo Choose launch mode:
echo.
echo [1] Development Mode (Recommended for testing)
echo [2] Production Build
echo [3] Desktop App (Electron)
echo [4] Run Tests
echo [5] Build All
echo [6] Run Diagnostic
echo [7] View Logs
echo [8] Cleanup Ports Only
echo [9] Exit
echo.
set /p choice="Enter your choice (1-9): "
echo [%date% %time%] User selected option: %choice% >> logs\launcher.log

if "%choice%"=="1" goto dev
if "%choice%"=="2" goto prod
if "%choice%"=="3" goto electron
if "%choice%"=="4" goto test
if "%choice%"=="5" goto build
if "%choice%"=="6" goto diagnostic
if "%choice%"=="7" goto viewlogs
if "%choice%"=="8" goto cleanup
if "%choice%"=="9" goto exit
goto invalid

:dev
echo.
echo Starting Project-Evolve-by-MythologIQ in Development Mode...
echo [%date% %time%] Starting development mode >> logs\launcher.log
echo.
echo Access the application at:
echo - Local: http://localhost:3000
echo - Network: http://192.168.0.29:3000
echo.
echo Press Ctrl+C to stop the server
echo.
echo [%date% %time%] Running: npm run dev >> logs\launcher.log
npm run dev
if %errorlevel% neq 0 (
    echo [%date% %time%] ERROR: Development server failed to start >> logs\launcher.log
    echo.
    echo Development server failed to start!
    echo Check logs\launcher.log for details.
    echo Report issues to: https://github.com/WulfForge/EvolveAI/issues
    echo.
    pause
)
goto end

:prod
echo.
echo Building and starting Project-Evolve-by-MythologIQ in Production Mode...
echo [%date% %time%] Starting production build >> logs\launcher.log
echo.
echo [%date% %time%] Running: npm run build >> logs\launcher.log
npm run build
if %errorlevel% neq 0 (
    echo [%date% %time%] ERROR: Production build failed >> logs\launcher.log
    echo Build failed! Check for errors above.
    echo Check logs\launcher.log for details.
    echo Report issues to: https://github.com/WulfForge/EvolveAI/issues
    pause
    goto end
)
echo.
echo Starting production server...
echo Access at: http://localhost:3000
echo.
echo [%date% %time%] Running: npm start >> logs\launcher.log
npm start
if %errorlevel% neq 0 (
    echo [%date% %time%] ERROR: Production server failed to start >> logs\launcher.log
    echo Production server failed to start!
    echo Check logs\launcher.log for details.
    echo Report issues to: https://github.com/WulfForge/EvolveAI/issues
    pause
)
goto end

:electron
echo.
echo Building and launching Project-Evolve-by-MythologIQ Desktop App...
echo [%date% %time%] Starting Electron build >> logs\launcher.log
echo.
echo Choose Electron launch mode:
echo [1] Development Mode (with hot reload)
echo [2] Production Build (standalone)
echo [3] Quick Development Test
echo.
set /p electron_choice="Enter your choice (1-3): "
echo [%date% %time%] User selected Electron option: %electron_choice% >> logs\launcher.log

if "%electron_choice%"=="1" goto electron_dev
if "%electron_choice%"=="2" goto electron_prod
if "%electron_choice%"=="3" goto electron_quick
goto electron_invalid

:electron_dev
echo.
echo Starting Electron in Development Mode...
echo [%date% %time%] Running: npm run electron:dev >> logs\launcher.log
npm run electron:dev
if %errorlevel% neq 0 (
    echo [%date% %time%] ERROR: Electron development mode failed >> logs\launcher.log
    echo Electron development mode failed!
    echo Check logs\launcher.log for details.
    echo Report issues to: https://github.com/WulfForge/EvolveAI/issues
    pause
)
goto end

:electron_prod
echo.
echo Building Electron app for production...
echo [%date% %time%] Running: npm run build:electron >> logs\launcher.log
npm run build:electron
if %errorlevel% neq 0 (
    echo [%date% %time%] ERROR: Electron production build failed >> logs\launcher.log
    echo Electron production build failed!
    echo Check logs\launcher.log for details.
    echo Report issues to: https://github.com/WulfForge/EvolveAI/issues
    pause
    goto end
)
echo.
echo Launching production Electron app...
echo [%date% %time%] Running: npm run electron:start >> logs\launcher.log
npm run electron:start
if %errorlevel% neq 0 (
    echo [%date% %time%] ERROR: Electron production app failed to launch >> logs\launcher.log
    echo Electron production app failed to launch!
    echo Check logs\launcher.log for details.
    echo Report issues to: https://github.com/WulfForge/EvolveAI/issues
    pause
)
goto end

:electron_quick
echo.
echo Quick Electron Development Test...
echo [%date% %time%] Running: npm run electron >> logs\launcher.log
npm run electron
if %errorlevel% neq 0 (
    echo [%date% %time%] ERROR: Quick Electron test failed >> logs\launcher.log
    echo Quick Electron test failed!
    echo Check logs\launcher.log for details.
    echo Report issues to: https://github.com/WulfForge/EvolveAI/issues
    pause
)
goto end

:electron_invalid
echo Invalid choice. Please select 1, 2, or 3.
goto electron

:test
echo.
echo Running Project-Evolve-by-MythologIQ Test Suite...
echo [%date% %time%] Starting test suite >> logs\launcher.log
echo.
echo [%date% %time%] Running: npm test >> logs\launcher.log
npm test
if %errorlevel% neq 0 (
    echo [%date% %time%] ERROR: Tests failed >> logs\launcher.log
    echo Tests failed! Check the output above.
    echo Check logs\launcher.log for details.
    echo Report issues to: https://github.com/WulfForge/EvolveAI/issues
) else (
    echo [%date% %time%] Tests completed successfully >> logs\launcher.log
    echo Tests completed successfully!
)
echo.
echo Tests completed! Press any key to continue...
pause
goto end

:build
echo.
echo Building Project-Evolve-by-MythologIQ (All Components)...
echo [%date% %time%] Starting full build process >> logs\launcher.log
echo.
echo 1. Building Next.js application...
echo [%date% %time%] Running: npm run build >> logs\launcher.log
npm run build
if %errorlevel% neq 0 (
    echo [%date% %time%] ERROR: Next.js build failed >> logs\launcher.log
    echo Next.js build failed!
    echo Check logs\launcher.log for details.
    echo Report issues to: https://github.com/WulfForge/EvolveAI/issues
    pause
    goto end
)
echo.
echo 2. Building Electron desktop app...
echo [%date% %time%] Running: npm run build:electron >> logs\launcher.log
npm run build:electron
if %errorlevel% neq 0 (
    echo [%date% %time%] ERROR: Electron build failed >> logs\launcher.log
    echo Electron build failed!
    echo Check logs\launcher.log for details.
    echo Report issues to: https://github.com/WulfForge/EvolveAI/issues
    pause
    goto end
)
echo.
echo 3. Running tests...
echo [%date% %time%] Running: npm test >> logs\launcher.log
npm test
if %errorlevel% neq 0 (
    echo [%date% %time%] ERROR: Tests failed >> logs\launcher.log
    echo Tests failed!
    echo Check logs\launcher.log for details.
    echo Report issues to: https://github.com/WulfForge/EvolveAI/issues
    pause
    goto end
)
echo.
echo ========================================
echo    BUILD COMPLETED SUCCESSFULLY!
echo ========================================
echo [%date% %time%] Full build completed successfully >> logs\launcher.log
echo.
echo Available launch options:
echo - Development: npm run dev
echo - Production: npm start
echo - Desktop: npm run electron
echo.
pause
goto end

:diagnostic
echo.
echo Running Project-Evolve-by-MythologIQ Diagnostic Tool...
echo [%date% %time%] Starting diagnostic tool >> logs\launcher.log
echo.
call diagnose-evolveai.bat
echo [%date% %time%] Diagnostic tool completed >> logs\launcher.log
goto end

:viewlogs
echo.
echo ========================================
echo    PROJECT-EVOLVE-BY-MYTHOLOGIQ LOGS
echo ========================================
echo [%date% %time%] User requested to view logs >> logs\launcher.log
echo.
if exist "logs\evolveai.log" (
    echo Main Application Log (last 20 lines):
    echo ----------------------------------------
    powershell "Get-Content logs\evolveai.log | Select-Object -Last 20"
    echo.
) else (
    echo No main application log found.
)
echo.
if exist "logs\evolveai-errors.log" (
    echo Error Log (last 10 lines):
    echo ---------------------------
    powershell "Get-Content logs\evolveai-errors.log | Select-Object -Last 10"
    echo.
) else (
    echo No error log found.
)
echo.
if exist "logs\launcher.log" (
    echo Launcher Log (last 10 lines):
    echo ------------------------------
    powershell "Get-Content logs\launcher.log | Select-Object -Last 10"
    echo.
) else (
    echo No launcher log found.
)
echo.
echo Log files location: logs\ directory
echo Report issues to: https://github.com/WulfForge/EvolveAI/issues
echo.
echo Press any key to continue...
pause >nul
goto end

:cleanup
echo.
echo ========================================
echo    AUTOMATIC PORT CLEANUP
echo ========================================
echo [%date% %time%] Starting automatic port cleanup >> logs\launcher.log

:: Kill any existing EvolveAI Node.js and Electron processes (safer approach)
taskkill /F /IM electron.exe >nul 2>&1

:: Only kill Node.js processes that are likely EvolveAI-related
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO CSV ^| findstr /I "node.exe"') do (
    set pid=%%a
    set pid=!pid:"=!
    :: Check if this process is using our target ports
    netstat -ano | findstr "!pid!" | findstr ":300" >nul
    if !errorlevel! equ 0 (
        echo Found EvolveAI Node.js process !pid! - stopping...
        taskkill /F /PID !pid! >nul 2>&1
    )
)

:: Clean up specific ports but only for Node.js and Electron processes
for %%p in (3000 3001 3002 3003 3004 3005) do (
    for /f "tokens=1,5" %%a in ('netstat -ano ^| findstr :%%p 2^>nul') do (
        set pid=%%b
        if not "!pid!"=="" (
            tasklist /FI "PID eq !pid!" /FI "IMAGENAME eq node.exe" >nul 2>&1
            if !errorlevel! equ 0 (
                taskkill /F /PID !pid! >nul 2>&1
            ) else (
                tasklist /FI "PID eq !pid!" /FI "IMAGENAME eq electron.exe" >nul 2>&1
                if !errorlevel! equ 0 (
                    taskkill /F /PID !pid! >nul 2>&1
                )
            )
        )
    )
)

echo ✓ Safe port cleanup completed
echo [%date% %time%] Safe port cleanup completed >> logs\launcher.log

goto end

:invalid
echo.
echo Invalid choice! Please enter a number between 1-9.
echo [%date% %time%] Invalid choice entered: %choice% >> logs\launcher.log
echo.
pause
goto end

:exit
echo.
echo Goodbye!
echo [%date% %time%] Launcher exited by user >> logs\launcher.log
exit /b 0

:end
echo.
echo [%date% %time%] Launcher operation completed >> logs\launcher.log
echo Project-Evolve-by-MythologIQ launcher finished.
echo. 