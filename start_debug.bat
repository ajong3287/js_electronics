@echo off
title JS일렉트로닉 ERP 디버그 모드
color 0a
echo ==========================================
echo JS일렉트로닉 ERP 디버그 모드
echo ==========================================
echo.

echo [디버그 1] 시스템 환경 확인
echo 운영체제: %OS%
echo 사용자: %USERNAME%
echo 경로: %CD%
echo.

echo [디버그 2] Node.js 설치 확인
where node
if %errorlevel% neq 0 (
    echo ❌ Node.js 경로를 찾을 수 없습니다
    echo.
    echo 해결 방법:
    echo 1. https://nodejs.org 방문
    echo 2. Windows Installer 다운로드
    echo 3. 관리자 권한으로 설치
    echo 4. 컴퓨터 재시작
    goto :error
) else (
    echo ✅ Node.js 경로 확인됨
)

echo.
echo [디버그 3] Node.js 버전 확인
node --version
if %errorlevel% neq 0 (
    echo ❌ Node.js 실행 실패
    goto :error
) else (
    echo ✅ Node.js 실행 확인
)

echo.
echo [디버그 4] NPM 확인
npm --version
if %errorlevel% neq 0 (
    echo ❌ NPM 실행 실패
    goto :error
) else (
    echo ✅ NPM 실행 확인
)

echo.
echo [디버그 5] 네트워크 연결 확인
ping -n 1 registry.npmjs.org >nul
if %errorlevel% neq 0 (
    echo ❌ NPM 저장소 연결 실패
    echo 인터넷 연결을 확인해주세요
    goto :error
) else (
    echo ✅ 네트워크 연결 확인
)

echo.
echo [디버그 6] 파일 구조 확인
if not exist "package.json" (
    echo ❌ package.json 파일이 없습니다
    echo 압축 해제가 제대로 되었는지 확인해주세요
    goto :error
) else (
    echo ✅ package.json 파일 확인
)

if not exist "server.js" (
    echo ❌ server.js 파일이 없습니다
    goto :error
) else (
    echo ✅ server.js 파일 확인
)

echo.
echo ==========================================
echo 모든 사전 확인 완료! 설치를 시작합니다.
echo ==========================================
echo.

echo [설치] NPM 패키지 설치 중...
npm install --no-audit --no-fund
if %errorlevel% neq 0 (
    echo ❌ 패키지 설치 실패
    echo.
    echo 수동 설치 시도:
    echo npm config set registry https://registry.npmjs.org/
    echo npm cache clean --force
    echo npm install
    goto :error
) else (
    echo ✅ 패키지 설치 완료
)

echo.
echo [실행] 서버 시작 중...
echo 브라우저가 자동으로 열립니다
echo.
timeout /t 3 >nul
start http://localhost:3001
npm start

goto :end

:error
echo.
echo ==========================================
echo ❌ 오류 발생
echo ==========================================
echo 위 정보를 개발자에게 전달해주세요.
echo.

:end
echo.
echo 아무 키나 누르면 종료됩니다...
pause >nul