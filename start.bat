@echo off
title JS일렉트로닉 ERP 시스템
echo ====================================
echo JS일렉트로닉 ERP 시스템 시작
echo ====================================
echo.
echo [1단계] Node.js 확인 중...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ Node.js가 설치되지 않았습니다.
    echo.
    echo 📥 Node.js 설치 방법:
    echo    1. https://nodejs.org 방문
    echo    2. LTS 버전 다운로드 (권장)
    echo    3. 설치 후 컴퓨터 재시작
    echo    4. 이 파일을 다시 실행
    echo.
    echo 💡 또는 수동 설치 확인:
    echo    명령 프롬프트에서 'node --version' 입력
    echo.
    pause
    exit /b 1
)

node --version
echo ✅ Node.js 설치 확인 완료

echo.
echo [2단계] 필요한 패키지 설치 중...
echo (처음 실행 시 1-2분 소요)
call npm install --no-audit --no-fund --silent
if %errorlevel% neq 0 (
    echo.
    echo ❌ 패키지 설치 실패
    echo 💡 인터넷 연결을 확인하고 다시 시도해주세요
    echo.
    pause
    exit /b 1
)
echo ✅ 패키지 설치 완료

echo.
echo [3단계] 서버 시작 중...
echo 💻 브라우저가 자동으로 열립니다
echo 📍 주소: http://localhost:3001
echo.
echo ⚠️  종료하려면 Ctrl+C를 누르세요
echo ====================================

timeout /t 2 >nul
start http://localhost:3001

npm start
if %errorlevel% neq 0 (
    echo.
    echo ❌ 서버 시작 실패
    echo 💡 포트 3001이 사용 중일 수 있습니다
    echo.
)
pause