# JS일렉트로닉 ERP 로컬 설치 가이드

## 1. 테스트 실행 (개발 모드)

터미널에서 다음 명령어를 실행하세요:

```bash
cd /Users/elicon_mark/Gemini_Projects/2_Project_JS_ElectronicsSMS/source_code

# 개발 모드로 실행 (React 개발 서버 사용)
npm run electron-dev
```

별도 터미널에서 React 개발 서버도 실행해야 합니다:
```bash
cd client
npm start
```

## 2. 실행 파일 생성 (배포용)

### Mac용 앱 생성
```bash
# React 빌드 먼저 실행
cd client
npm run build

# 루트로 돌아가서 Mac 앱 생성
cd ..
npm run build-mac
```

생성된 파일 위치: `dist/JS일렉트로닉 ERP-1.0.0.dmg`

### Windows용 설치 파일 생성
```bash
# React 빌드 먼저 실행
cd client
npm run build

# 루트로 돌아가서 Windows 설치파일 생성
cd ..
npm run build-win
```

생성된 파일 위치: `dist/JS일렉트로닉 ERP Setup 1.0.0.exe`

## 3. 설치 및 사용

### Mac 사용자
1. `JS일렉트로닉 ERP-1.0.0.dmg` 파일 더블클릭
2. 앱을 Applications 폴더로 드래그
3. Applications에서 JS일렉트로닉 ERP 실행

### Windows 사용자
1. `JS일렉트로닉 ERP Setup 1.0.0.exe` 파일 더블클릭
2. 설치 마법사 따라 진행
3. 바탕화면 아이콘 클릭하여 실행

## 4. 주요 기능

- **엑셀 파일 업로드**: 매출 데이터 Excel 파일 가져오기
- **매출 관리**: 일별/월별 매출 현황 확인
- **거래처 관리**: 거래처별 매출 분석
- **품목 관리**: 제품별 판매 현황
- **보고서**: 각종 분석 보고서 생성
- **AI 도우미**: 채팅 형식의 데이터 조회

## 5. 데이터 저장 위치

- Mac: `~/Library/Application Support/JS일렉트로닉 ERP/`
- Windows: `%APPDATA%/JS일렉트로닉 ERP/`
- 데이터베이스: `jserp.db` (SQLite)

## 6. 문제 해결

### 앱이 실행되지 않을 때
- Mac: 시스템 환경설정 > 보안 및 개인정보에서 앱 실행 허용
- Windows: Windows Defender에서 차단 해제

### 데이터가 보이지 않을 때
- 서버가 제대로 시작되었는지 확인
- 3001 포트가 사용 가능한지 확인

## 7. 업데이트

새 버전이 출시되면:
1. 기존 앱 제거
2. 새 설치 파일 다운로드
3. 위 설치 과정 반복

## 8. 기술 지원

문의: 엘리콘
전화: [전화번호]
이메일: [이메일]