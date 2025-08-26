@echo off
chcp 65001 >nul
title Install JS ERP as Windows Service
echo ==========================================
echo Install JS ERP as Windows Service
echo ==========================================
echo.

echo This will install JS ERP to run automatically
echo when Windows starts (like a regular program).
echo.
echo Benefits:
echo - No black window to keep open
echo - Starts automatically with Windows  
echo - Runs in background
echo - Access via browser anytime
echo.

set /p CONFIRM="Continue? (y/n): "
if /i "%CONFIRM%" neq "y" goto :cancel

echo.
echo Installing npm pm2 (process manager)...
npm install -g pm2
npm install -g pm2-windows-startup

echo.
echo Configuring PM2 for Windows startup...
pm2-startup install

echo.
echo Starting ERP service...
pm2 start server.js --name "JS-ERP"
pm2 save

echo.
echo ✅ Installation Complete!
echo.
echo JS ERP is now running as a Windows service.
echo.
echo How to use:
echo - Open browser and go to: http://localhost:3001
echo - ERP will start automatically when Windows starts
echo.
echo Service Management:
echo - Stop service: pm2 stop JS-ERP  
echo - Start service: pm2 start JS-ERP
echo - Remove service: pm2 delete JS-ERP && pm2 unstartup
echo.
goto :end

:cancel
echo Installation cancelled.

:end
pause