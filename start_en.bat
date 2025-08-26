@echo off
chcp 65001 >nul
title JS Electronics ERP System
color 0a
echo ==========================================
echo JS Electronics ERP System v1.0
echo ==========================================
echo.

echo [Step 1] Checking Node.js installation...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Node.js is not installed.
    echo.
    echo How to install Node.js:
    echo 1. Visit https://nodejs.org
    echo 2. Download LTS version
    echo 3. Install with admin rights
    echo 4. Restart computer
    echo 5. Run this file again
    echo.
    pause
    exit /b 1
) else (
    echo OK: Node.js found
)

node --version
echo OK: Node.js version check complete
echo.

echo [Step 2] Installing packages...
echo (This may take 1-2 minutes on first run)
call npm install --no-audit --no-fund --silent
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Package installation failed
    echo Please check your internet connection
    echo.
    pause
    exit /b 1
)
echo OK: Package installation complete
echo.

echo [Step 3] Starting server...
echo Server will start on port 3001
echo URL: http://localhost:3001
echo.
echo Press Ctrl+C to stop the server
echo ==========================================

echo Starting ERP server...
start /min npm start

echo Waiting for server to start...
timeout /t 5 >nul

echo Testing connection...
curl -s http://localhost:3001 >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ⚠️  Connection test failed
    echo Please wait a moment and try manually:
    echo Open browser and go to: http://localhost:3001
    echo.
    echo If still not working, run: troubleshoot.bat
) else (
    echo ✅ Server connection OK
    echo Opening browser...
    start http://localhost:3001
)

echo.
echo Server is running in background window
echo To stop: Close all command windows
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Server start failed
    echo Port 3001 might be in use
    echo.
)
pause