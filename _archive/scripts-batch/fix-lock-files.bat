@echo off
title EvolveAI Lock File & Dependency Fixer
color 0A

echo.
echo ========================================
echo    EVOLVEAI LOCK FILE FIXER
echo ========================================
echo.

echo [1/6] Checking for lock file conflicts...
if exist "pnpm-lock.yaml" (
    echo Found pnpm-lock.yaml - removing to prevent conflicts
    del "pnpm-lock.yaml"
    echo ✓ Removed pnpm-lock.yaml
) else (
    echo ✓ No pnpm-lock.yaml found
)

if exist "yarn.lock" (
    echo Found yarn.lock - removing to prevent conflicts
    del "yarn.lock"
    echo ✓ Removed yarn.lock
) else (
    echo ✓ No yarn.lock found
)

echo.
echo [2/6] Cleaning npm cache...
call npm cache clean --force
if !errorlevel! equ 0 (
    echo ✓ NPM cache cleaned
) else (
    echo ⚠ Could not clean NPM cache
)

echo.
echo [3/6] Removing node_modules and package-lock.json...
if exist "node_modules" (
    echo Removing node_modules...
    rmdir /s /q "node_modules"
    echo ✓ Removed node_modules
) else (
    echo ✓ No node_modules found
)

if exist "package-lock.json" (
    echo Removing package-lock.json...
    del "package-lock.json"
    echo ✓ Removed package-lock.json
) else (
    echo ✓ No package-lock.json found
)

echo.
echo [4/6] Installing dependencies fresh...
call npm install
if !errorlevel! equ 0 (
    echo ✓ Dependencies installed successfully
) else (
    echo ✗ Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [5/6] Running security audit and fixing non-breaking issues...
call npm audit fix
if !errorlevel! equ 0 (
    echo ✓ Security issues fixed
) else (
    echo ⚠ Some security issues remain (may require manual review)
)

echo.
echo [6/6] Final verification...
call npm ls --depth=0
if !errorlevel! equ 0 (
    echo ✓ Package verification successful
) else (
    echo ⚠ Package verification issues detected
)

echo.
echo ========================================
echo    LOCK FILE FIX COMPLETED
echo ========================================
echo.
echo Actions taken:
echo - Removed conflicting lock files
echo - Cleaned NPM cache
echo - Fresh dependency installation
echo - Security audit and fixes
echo.
echo Your project should now have:
echo - Clean package-lock.json
echo - No conflicting lock files
echo - Updated dependencies
echo - Resolved security issues
echo.
pause 