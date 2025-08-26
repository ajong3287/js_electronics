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

echo [Step 3] Building client application...
echo Building React frontend (this may take 2-3 minutes)...
cd client

echo - Installing client dependencies...
call npm install --no-audit --no-fund --silent --legacy-peer-deps
if %errorlevel% neq 0 (
    echo ERROR: Client package installation failed
    echo Trying with legacy peer deps...
    call npm install --no-audit --no-fund --silent --legacy-peer-deps --force
    if %errorlevel% neq 0 (
        echo ERROR: Client installation completely failed
        echo.
        pause
        exit /b 1
    )
)

echo - Building React application...
set GENERATE_SOURCEMAP=false
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Client build failed
    echo Checking build requirements...
    dir build >nul 2>&1
    if %errorlevel% neq 0 (
        echo Build directory missing - critical error
    )
    echo.
    pause
    exit /b 1
)

echo - Verifying build output...
if not exist "build\index.html" (
    echo ERROR: Build incomplete - index.html missing
    pause
    exit /b 1
)

cd ..
echo OK: Client build complete and verified
echo.

echo [Step 4] Starting server...
echo Server will start on port 3001
echo URL: http://localhost:3001
echo.
echo Press Ctrl+C to stop the server
echo ==========================================

echo Starting ERP server...
start "" node server.js

echo Waiting for server to start...
timeout /t 8 >nul

echo Testing connection...
powershell -Command "try { Invoke-WebRequest -Uri http://localhost:3001 -UseBasicParsing -TimeoutSec 5 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ⚠️  Connection test failed
    echo Checking if server is starting...
    timeout /t 3 >nul
    powershell -Command "try { Invoke-WebRequest -Uri http://localhost:3001 -UseBasicParsing -TimeoutSec 5 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo Please wait a moment and try manually:
        echo Open browser and go to: http://localhost:3001
        echo.
        echo If still not working, run: troubleshoot.bat
    ) else (
        echo ✅ Server connection OK (after retry)
        echo Opening browser...
        start http://localhost:3001
    )
) else (
    echo ✅ Server connection OK
    echo Opening browser...
    start http://localhost:3001
)

echo.
echo Server is running in command window
echo To stop: Press Ctrl+C in the server window
echo.
echo IMPORTANT: Keep the black command window open while using the ERP
pause