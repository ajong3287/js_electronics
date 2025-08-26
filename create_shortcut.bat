@echo off
chcp 65001 >nul
title Create Desktop Shortcut
echo ==========================================
echo Create JS ERP Desktop Shortcut
echo ==========================================
echo.

echo Creating desktop shortcut for easy access...

set CURRENT_DIR=%CD%

echo Creating "JS ERP.bat" shortcut...
(
echo @echo off
echo cd /d "%CURRENT_DIR%"
echo start /min npm start
echo timeout /t 3 ^>nul
echo start http://localhost:3001
echo echo JS ERP is running in background
echo echo Open browser: http://localhost:3001
echo pause
) > "%USERPROFILE%\Desktop\JS ERP.bat"

echo.
echo ✅ Desktop shortcut created!
echo.
echo Now you can:
echo 1. Double-click "JS ERP.bat" on your desktop
echo 2. ERP starts automatically
echo 3. Browser opens to ERP
echo.
echo The black window will minimize automatically.
echo Just close it when you're done using ERP.
echo.
pause