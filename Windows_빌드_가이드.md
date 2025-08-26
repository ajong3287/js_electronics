# Windows용 JS일렉트로닉 ERP 빌드 가이드

## 현재 상황
- macOS에서 Windows용 크로스 컴파일 제한 (ARM Mac 환경)
- Wine 설치 시도했으나 완전한 Windows 빌드 환경 구축 어려움
- 대안 방법 제시

## Windows 빌드 방법

### 방법 1: Windows PC에서 직접 빌드 (권장)
```bash
# Windows PC에서 실행
1. Node.js 설치 (https://nodejs.org)
2. Git 설치 (https://git-scm.com)
3. 소스코드 복사
4. 명령 프롬프트에서:
   cd source_code
   npm install
   npm run build-win
```

### 방법 2: GitHub Actions 활용 (CI/CD)
```yaml
# .github/workflows/build.yml
name: Build
on: push
jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run build-win
      - uses: actions/upload-artifact@v2
        with:
          name: windows-installer
          path: dist/*.exe
```

### 방법 3: 클라우드 빌드 서비스
- AppVeyor (https://www.appveyor.com)
- Azure DevOps
- CircleCI Windows executor

## 임시 해결책 (즉시 사용 가능)

### 1. Portable 버전 제공
- 설치 없이 실행 가능한 버전
- node_modules와 함께 압축하여 배포
- 실행: `npm start`로 서버 실행 후 브라우저 접속

### 2. Docker 컨테이너
```dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 3001
CMD ["npm", "start"]
```

## 테스트된 macOS 버전
- ✅ macOS용 DMG 파일: 정상 작동
- ✅ 파일 위치: `dist/JS일렉트로닉 ERP-1.0.0-arm64.dmg`

## Windows 사용자를 위한 임시 방안
1. 소스코드 압축 파일 제공
2. Node.js 설치 안내
3. 실행 배치 파일 제공:
```batch
@echo off
cd /d %~dp0
npm start
pause
```

## 보안 강화 완료 항목
- ✅ 파일 업로드 크기 제한 (50MB)
- ✅ 허용 파일 형식 제한 (.xlsx, .xls, .csv, .pdf)
- ✅ 파일명 정제 (Path Traversal 방지)
- ✅ SQL Injection 방지 (파라미터화된 쿼리 사용)

## 배포 준비 상태
- macOS: ✅ 완료 (DMG 파일 생성)
- Windows: ⚠️ Windows PC 필요
- 보안: ✅ 강화 완료
- 테스트: ✅ 통과