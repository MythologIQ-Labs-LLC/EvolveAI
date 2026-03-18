@echo off
echo ========================================
echo    EvolveAI Automated Build
echo ========================================
echo.
echo This will automatically build EvolveAI with:
echo - Hang-up detection and recovery
echo - Progress monitoring
echo - Error reporting
echo - Automatic restarts
echo.
echo Expected time: 5-15 minutes
echo.
pause

:: Run the build monitor
call scripts\build-monitor.bat

:: If we get here, the build completed
echo.
echo Build process finished!
echo Check the logs directory for detailed information.
pause 