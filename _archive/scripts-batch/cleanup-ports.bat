@echo off
title EvolveAI Port Cleanup
color 0C

echo.
echo ========================================
echo    EVOLVEAI PORT CLEANUP UTILITY
echo ========================================
echo.

:: Function to safely kill processes on a specific port
:safeKillPort
set port=%1
echo Checking port %port%...

:: Find processes using the port, but only target Node.js and Electron processes
for /f "tokens=1,5" %%a in ('netstat -ano ^| findstr :%port%') do (
    set pid=%%b
    if not "!pid!"=="" (
        :: Check if this is a Node.js or Electron process before killing
        tasklist /FI "PID eq !pid!" /FI "IMAGENAME eq node.exe" >nul 2>&1
        if !errorlevel! equ 0 (
            echo Found Node.js process !pid! on port %port%
            taskkill /F /PID !pid! >nul 2>&1
            if !errorlevel! equ 0 (
                echo ✓ Killed Node.js process !pid!
            ) else (
                echo ⚠ Could not kill Node.js process !pid!
            )
        ) else (
            tasklist /FI "PID eq !pid!" /FI "IMAGENAME eq electron.exe" >nul 2>&1
            if !errorlevel! equ 0 (
                echo Found Electron process !pid! on port %port%
                taskkill /F /PID !pid! >nul 2>&1
                if !errorlevel! equ 0 (
                    echo ✓ Killed Electron process !pid!
                ) else (
                    echo ⚠ Could not kill Electron process !pid!
                )
            ) else (
                echo ⚠ Found non-EvolveAI process !pid! on port %port% - skipping
            )
        )
    )
)
goto :eof

:: Enable delayed expansion for variables in loops
setlocal enabledelayedexpansion

echo [1/4] Checking for EvolveAI Node.js processes...
tasklist /FI "IMAGENAME eq node.exe" /FI "WINDOWTITLE eq *EvolveAI*" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo Found EvolveAI Node.js processes running
    echo Stopping EvolveAI Node.js processes...
    taskkill /F /FI "WINDOWTITLE eq *EvolveAI*" /IM node.exe >nul 2>&1
    if !errorlevel! equ 0 (
        echo ✓ Stopped EvolveAI Node.js processes
    ) else (
        echo ⚠ Could not stop all EvolveAI Node.js processes
    )
) else (
    echo ✓ No EvolveAI Node.js processes found
)

echo.
echo [2/4] Checking for Electron processes...
tasklist /FI "IMAGENAME eq electron.exe" 2>NUL | find /I /N "electron.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo Found Electron processes running
    echo Stopping Electron processes...
    taskkill /F /IM electron.exe >nul 2>&1
    if !errorlevel! equ 0 (
        echo ✓ Stopped Electron processes
    ) else (
        echo ⚠ Could not stop all Electron processes
    )
) else (
    echo ✓ No Electron processes found
)

echo.
echo [3/4] Safely cleaning up specific ports...

:: Only clean up ports that are reserved for EvolveAI (4000-4010)
call :safeKillPort 4000
call :safeKillPort 4001
call :safeKillPort 4002
call :safeKillPort 4003
call :safeKillPort 4004
call :safeKillPort 4005
call :safeKillPort 4006
call :safeKillPort 4007
call :safeKillPort 4008
call :safeKillPort 4009
call :safeKillPort 4010

echo.
echo [4/4] Checking for any remaining EvolveAI processes on our reserved ports...
for %%p in (4000 4001 4002 4003 4004 4005 4006 4007 4008 4009 4010) do (
    netstat -ano | findstr :%%p >nul
    if !errorlevel! equ 0 (
        echo ⚠ Port %%p is still in use (may be system process)
    ) else (
        echo ✓ Port %%p is free
    )
)

echo.
echo ========================================
echo    CLEANUP COMPLETED
echo ========================================
echo.
echo Only EvolveAI-related processes have been cleaned up.
echo System processes have been preserved for safety.
echo You can now restart the application without port conflicts.
echo.
pause 