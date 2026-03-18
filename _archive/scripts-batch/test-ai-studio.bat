@echo off
title EvolveAI AI Studio Test
color 0C

echo.
echo ========================================
echo    EVOLVEAI AI STUDIO API TEST
echo ========================================
echo.

:: Check if Next.js server is running
echo [1/4] Checking if Next.js server is running...
netstat -an | findstr ":3000" >nul
if %errorlevel% neq 0 (
    echo ❌ Next.js server is not running on port 3000
    echo.
    echo Please start the development server first:
    echo npm run dev
    echo.
    pause
    exit /b 1
)
echo ✓ Next.js server is running

:: Get API key from user
echo.
echo [2/4] API Key Input
echo.
set /p api_key="Enter your Google AI Studio API key: "

if "%api_key%"=="" (
    echo ❌ API key is required
    pause
    exit /b 1
)

:: Test API key format
echo.
echo [3/4] Testing API key format...
if %api_key:~0,2%==AI (
    echo ✓ API key format looks correct (starts with AI)
) else (
    echo ⚠️  API key format may be incorrect (should start with AI)
)

:: Test API connection
echo.
echo [4/4] Testing API connection...
echo.

:: Create a temporary test file
echo { "apiKey": "%api_key%" } > temp_test.json

:: Test the connection
curl -X POST http://localhost:3000/api/ai-studio/test ^
  -H "Content-Type: application/json" ^
  -d @temp_test.json ^
  --silent --show-error > temp_response.json 2>&1

:: Check if curl was successful
if %errorlevel% neq 0 (
    echo ❌ Failed to connect to the API endpoint
    echo.
    echo Possible issues:
    echo - Next.js server is not running
    echo - Port 3000 is blocked
    echo - Network connectivity issues
    echo.
    del temp_test.json 2>nul
    del temp_response.json 2>nul
    pause
    exit /b 1
)

:: Parse and display the response
echo API Response:
type temp_response.json
echo.

:: Check if the response indicates success
findstr /i "success.*true" temp_response.json >nul
if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo    ✅ AI STUDIO CONNECTION SUCCESSFUL!
    echo ========================================
    echo.
    echo Your Google AI Studio API key is working correctly.
    echo You can now use the AI features in EvolveAI.
    echo.
) else (
    echo.
    echo ========================================
    echo    ❌ AI STUDIO CONNECTION FAILED
    echo ========================================
    echo.
    echo Possible issues:
    echo - Invalid API key
    echo - API quota exceeded
    echo - Service temporarily unavailable
    echo - Network connectivity issues
    echo.
    echo Please check your API key and try again.
    echo.
)

:: Clean up temporary files
del temp_test.json 2>nul
del temp_response.json 2>nul

echo Test completed!
echo.
pause 