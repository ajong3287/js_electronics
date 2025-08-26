@echo off
chcp 65001 >nul
title JS ERP Troubleshooting Tool
color 0c
echo ==========================================
echo JS Electronics ERP Troubleshooting
echo ==========================================
echo.

echo [CHECK 1] Port 3001 Status Check
netstat -ano | findstr :3001
if %errorlevel% neq 0 (
    echo ❌ Port 3001 is not in use - Server not running
) else (
    echo ✅ Port 3001 is in use
)
echo.

echo [CHECK 2] Localhost Connection Test
ping -n 1 127.0.0.1 >nul
if %errorlevel% neq 0 (
    echo ❌ Localhost connection failed
) else (
    echo ✅ Localhost connection OK
)
echo.

echo [CHECK 3] HTTP Connection Test
echo Testing http://localhost:3001...
curl -s http://localhost:3001 >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ HTTP connection to localhost:3001 failed
    echo.
    echo Possible solutions:
    echo 1. Server is not running - run start_en.bat
    echo 2. Firewall blocking connection
    echo 3. Another program using port 3001
) else (
    echo ✅ HTTP connection to localhost:3001 OK
)
echo.

echo [CHECK 4] Firewall Test
echo Checking Windows Firewall...
netsh advfirewall show allprofiles | findstr "State" 
echo.

echo [CHECK 5] Process Check
echo Looking for Node.js processes...
tasklist | findstr node.exe
if %errorlevel% neq 0 (
    echo ❌ No Node.js processes found
    echo Server may not be running
) else (
    echo ✅ Node.js processes found
)
echo.

echo [CHECK 6] Browser Test
echo Opening browser to test...
timeout /t 2 >nul
start http://localhost:3001
echo If browser doesn't open the ERP, there's a connection problem.
echo.

echo ==========================================
echo Troubleshooting Complete
echo ==========================================
echo.
echo Common Solutions:
echo 1. Run as Administrator
echo 2. Disable Windows Firewall temporarily  
echo 3. Check antivirus software
echo 4. Restart computer
echo.
pause