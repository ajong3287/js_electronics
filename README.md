# JS일렉트로닉 ERP 시스템

중소기업을 위한 경량화된 ERP 시스템으로, 매출 관리와 고객 관리 기능을 제공합니다.

## 주요 기능

- **매출 관리**: Excel 파일 업로드를 통한 매출 데이터 관리
- **고객 관리**: 거래처별 매출 추적 및 분석
- **품목 분석**: 제품별 판매 현황 및 통계
- **AI 분석**: Google Generative AI를 활용한 지능형 분석
- **크로스 플랫폼**: Windows와 macOS 지원

## 기술 스택

- **Backend**: Node.js, Express.js
- **Frontend**: React
- **Database**: SQLite3
- **Desktop**: Electron
- **File Processing**: ExcelJS
- **AI**: Google Generative AI

## 시작하기

### 사전 요구사항

- Node.js 18.0 이상
- npm 또는 yarn

### 설치

```bash
# 저장소 클론
git clone https://github.com/[your-username]/js-electronics-erp.git
cd js-electronics-erp

# 의존성 설치
npm install

# 클라이언트 의존성 설치
cd client
npm install
cd ..
```

### 개발 서버 실행

```bash
# 백엔드 서버 실행 (포트 3001)
npm start

# 새 터미널에서 프론트엔드 실행 (포트 3000)
cd client
npm start
```

### 프로덕션 빌드

```bash
# Windows용 실행파일 생성
npm run build-win

# macOS용 실행파일 생성
npm run build-mac
```

## 프로젝트 구조

```
js-electronics-erp/
├── server.js           # Express 서버
├── database.js         # 데이터베이스 관리
├── package.json        # 프로젝트 설정
├── client/             # React 프론트엔드
│   ├── src/
│   ├── public/
│   └── package.json
├── database/           # SQLite 데이터베이스
├── uploads/            # 업로드된 파일
├── logs/               # 로그 파일
└── docs/               # 문서
```

## API 엔드포인트

- `GET /api/sales` - 매출 데이터 조회
- `POST /api/upload` - Excel 파일 업로드
- `GET /api/customers` - 고객 목록 조회
- `GET /api/dashboard/stats` - 대시보드 통계

## 보안

- npm audit 취약점 0개
- SQL Injection 방지 (매개변수화된 쿼리)
- 파일 업로드 보안 (크기/타입 제한)
- Path Traversal 공격 방지

## 라이선스

ISC License

## 기여

이슈 및 풀 리퀘스트는 언제든 환영합니다.

## 연락처

프로젝트 관련 문의사항이 있으시면 이슈를 생성해주세요.

---

**현재 버전**: 1.0.0  
**보안 상태**: A+ (취약점 0개)  
**최종 업데이트**: 2025-08-26