@echo off
chcp 65001 > nul
echo ====================================
echo JS Electronics ERP - Complete Removal
echo ====================================
echo.
echo WARNING: This will completely remove all ERP installations
echo Press Ctrl+C to cancel or any key to continue...
pause > nul
echo.

REM Administrator check
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Administrator privileges required
    echo Right-click and select "Run as Administrator"
    pause
    exit /b 1
)

echo [Step 1/7] Stopping all Node.js and browser processes...
taskkill /F /IM node.exe > nul 2>&1
taskkill /F /IM chrome.exe > nul 2>&1
taskkill /F /IM msedge.exe > nul 2>&1
taskkill /F /IM "JS일렉트로닉 ERP.exe" > nul 2>&1
taskkill /F /IM "elicon-erp.exe" > nul 2>&1
echo    - Processes terminated

echo [Step 2/7] Clearing ports 3001, 3000...
netstat -ano | findstr :3001 > temp_ports.txt 2>nul
if exist temp_ports.txt (
    for /f "tokens=5" %%a in (temp_ports.txt) do taskkill /F /PID %%a > nul 2>&1
    del temp_ports.txt > nul 2>&1
)
netstat -ano | findstr :3000 > temp_ports.txt 2>nul
if exist temp_ports.txt (
    for /f "tokens=5" %%a in (temp_ports.txt) do taskkill /F /PID %%a > nul 2>&1
    del temp_ports.txt > nul 2>&1
)
echo    - Ports cleared

echo [Step 3/7] Removing program folders...
if exist "C:\Program Files\JS일렉트로닉 ERP" (
    rmdir /s /q "C:\Program Files\JS일렉트로닉 ERP" > nul 2>&1
    echo    - Program Files folder removed
)
if exist "C:\Program Files (x86)\JS일렉트로닉 ERP" (
    rmdir /s /q "C:\Program Files (x86)\JS일렉트로닉 ERP" > nul 2>&1
    echo    - Program Files (x86) folder removed
)

echo [Step 4/7] Clearing user data and cache...
if exist "%APPDATA%\elicon-erp" (
    rmdir /s /q "%APPDATA%\elicon-erp" > nul 2>&1
    echo    - AppData folder removed
)
if exist "%LOCALAPPDATA%\elicon-erp" (
    rmdir /s /q "%LOCALAPPDATA%\elicon-erp" > nul 2>&1
    echo    - LocalAppData folder removed
)
rd /S /Q "%temp%\npm*" > nul 2>&1
rd /S /Q "%APPDATA%\npm-cache" > nul 2>&1
echo    - Cache cleared

echo [Step 5/7] Removing registry entries...
reg delete "HKEY_CURRENT_USER\Software\elicon-erp" /f > nul 2>&1
reg delete "HKEY_LOCAL_MACHINE\SOFTWARE\elicon-erp" /f > nul 2>&1
reg delete "HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\elicon-erp" /f > nul 2>&1
reg delete "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run" /v "JS_ERP" /f > nul 2>&1
echo    - Registry cleaned

echo [Step 6/7] Removing desktop shortcuts...
del "%USERPROFILE%\Desktop\JS일렉트로닉 ERP.lnk" > nul 2>&1
del "%USERPROFILE%\Desktop\JS ERP.bat" > nul 2>&1
del "%USERPROFILE%\Desktop\JS Electronics ERP.lnk" > nul 2>&1
echo    - Desktop shortcuts removed

echo [Step 7/7] Removing start menu items...
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\JS일렉트로닉 ERP.lnk" > nul 2>&1
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\JS Electronics ERP.lnk" > nul 2>&1
echo    - Start menu items removed

echo.
echo ====================================
echo   COMPLETE REMOVAL FINISHED!
echo ====================================
echo All JS Electronics ERP installations have been removed.
echo You can now safely install the new version.
echo.
echo IMPORTANT: Restart your computer before installing new version
echo           to ensure all services are properly cleared.
echo.
pause