# 제이에스일렉트로닉 프로젝트 지침서

## 프로젝트 개요
- **고객사**: 제이에스일렉트로닉 (JS Electronics)
- **프로젝트**: 소형 ERP 시스템
- **기술 스택**: Node.js, Express, React, Excel 처리 (xlsx)

## 주요 기능
1. **매출 관리**: Excel 파일 업로드 및 분석
2. **거래처 관리**: 고객사별 매출 추적
3. **품목별 분석**: 제품별 판매 현황
4. **AI 통합**: Google Generative AI 활용

## 프로젝트 구조
```
2_js-electronics/
├── server.js         # Express 백엔드
├── client/           # React 프론트엔드
├── clients/          # 고객 데이터
├── uploads/          # 업로드 파일
├── docs/             # 프로젝트 문서
├── logs/             # 작업 로그
└── assets/           # 리소스 파일
```

## 서버 실행
```bash
cd ~/Developer/2_js-electronics
# 백엔드 실행
npm start

# 프론트엔드 실행 (새 터미널)
cd client
npm start
```

## API 엔드포인트
- `/api/js-electronics/data` - 매출 데이터 조회
- `/api/upload` - Excel 파일 업로드

## 작업 기록
- 2025-07-23: 프로젝트 위치 이동 (2_ClientA → 2_js-electronics)