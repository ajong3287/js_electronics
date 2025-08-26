@echo off
chcp 65001 > nul
title JS Electronics ERP - Portable v1.0
color 0A

echo ====================================
echo  JS Electronics ERP Portable v1.0
echo ====================================
echo.
echo [INFO] 포터블 ERP 시스템 시작 중...
echo [INFO] Node.js 런타임 확인 중...

if not exist "node\node.exe" (
    echo [ERROR] Node.js 런타임이 없습니다!
    echo [ERROR] 포터블 패키지가 손상되었습니다.
    pause
    exit /b 1
)

if not exist "server.js" (
    echo [ERROR] 서버 파일이 없습니다!
    echo [ERROR] 포터블 패키지가 손상되었습니다.
    pause
    exit /b 1
)

echo [INFO] 종속성 설치 중...
node\node.exe node\npm.cmd install --omit=dev --silent

echo.
echo [SUCCESS] ERP 서버 시작 완료!
echo [INFO] 브라우저에서 http://localhost:3001 접속하세요
echo [INFO] 종료하려면 Ctrl+C 누르세요
echo.

node\node.exe server.js

echo.
echo [INFO] ERP 서버가 종료되었습니다.
pause