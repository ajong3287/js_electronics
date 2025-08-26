# 기술 명세서 - JS Electronics ERP

## 시스템 요구사항

### 최소 시스템 요구사항
**Windows**:
- OS: Windows 10 이상
- RAM: 4GB 이상
- 디스크: 500MB 여유공간
- 네트워크: 인터넷 연결 (AI 기능용)

**macOS**:
- OS: macOS 11.0 이상
- 프로세서: Intel 또는 Apple Silicon
- RAM: 4GB 이상
- 디스크: 500MB 여유공간

## 기술 스택 상세

### Backend 기술
```json
{
  "runtime": "Node.js 18+",
  "framework": "Express.js 4.18.2",
  "database": "SQLite3 5.1.7",
  "file_processing": "ExcelJS 4.4.0",
  "ai_integration": "@google/generative-ai 0.1.3",
  "security": {
    "file_upload": "Multer 2.0.2",
    "cors": "CORS 2.8.5",
    "validation": "매개변수화된 SQL 쿼리"
  }
}
```

### Frontend 기술
```json
{
  "framework": "React 18+",
  "bundler": "Create React App",
  "styling": "CSS3 + Responsive Design",
  "state_management": "React Hooks",
  "http_client": "Fetch API"
}
```

### 패키징 및 배포
```json
{
  "desktop_framework": "Electron 37.3.1",
  "builder": "electron-builder 26.0.12",
  "platforms": ["Windows x64/x32", "macOS ARM64/Intel"],
  "distribution": "NSIS (Windows), DMG (macOS)"
}
```

## API 명세

### 인증 및 보안
- 현재: 로컬 네트워크 기반 (포트 3001)
- CORS 정책: 개발환경 허용
- 파일 업로드: 50MB 제한, 확장자 화이트리스트

### 데이터 흐름
```
Excel 업로드 → 서버 검증 → ExcelJS 파싱 → SQLite 저장 → React 화면 표시
```

### 에러 핸들링
- HTTP 상태 코드 표준 준수
- 구조화된 에러 응답
- 클라이언트 측 에러 바운더리

## 데이터베이스 설계

### 테이블 구조
```sql
-- 매출 거래 테이블
sales_transactions (
  id: INTEGER PRIMARY KEY,
  date: TEXT (YYYY-MM-DD),
  customer_name: TEXT,
  product_name: TEXT,
  quantity: INTEGER,
  unit_price: REAL,
  total_amount: REAL,
  created_at: DATETIME
)

-- 고객 마스터 테이블  
customers (
  id: INTEGER PRIMARY KEY,
  name: TEXT UNIQUE,
  contact: TEXT,
  address: TEXT,
  created_at: DATETIME
)
```

### 인덱스 최적화
- customer_name 인덱스 (빈번한 조회)
- date 범위 인덱스 (기간별 분석)
- 복합 인덱스: (customer_name, date)

## 성능 특성

### 처리 성능
- Excel 파싱: ~1000행/초
- 데이터베이스 조회: <50ms
- 대시보드 렌더링: <200ms
- AI 분석 응답: 2-5초

### 메모리 사용량
- 기본 실행: ~80MB
- Excel 파일 처리 시: +20-50MB
- React 렌더링: ~30MB
- 총 예상 사용량: 100-150MB

### 스토리지
- 실행 파일: 120-150MB
- 데이터베이스: 연간 ~100MB
- 로그 및 캐시: ~10MB

## 보안 구현

### 입력 검증
```javascript
// 파일 업로드 보안
const allowedExtensions = ['.xlsx', '.xls', '.csv', '.pdf'];
const maxFileSize = 50 * 1024 * 1024; // 50MB

// SQL Injection 방지
db.prepare("SELECT * FROM sales WHERE customer = ?").all(customerName);
```

### 파일 시스템 보안
- Path Traversal 방지: 파일명 정제
- 업로드 디렉토리 격리
- 임시 파일 자동 정리

### 네트워크 보안
- HTTPS 준비 (프로덕션 배포 시)
- CORS 정책 적용
- 포트 제한 (3001)

## AI 기능 상세

### Google Generative AI 통합
```javascript
// AI 분석 요청 구조
{
  model: "gemini-pro",
  input: "매출 데이터 + 분석 요청",
  parameters: {
    temperature: 0.7,
    maxTokens: 1000
  }
}
```

### 분석 기능
- 매출 트렌드 분석
- 고객별 구매 패턴
- 계절성 분석
- 예측 및 추천

## 확장 가능성

### 단기 확장 (3-6개월)
- 사용자 인증 시스템
- 권한 관리 (관리자/사용자)
- 데이터 백업 자동화
- 모바일 반응형 UI

### 중기 확장 (6-12개월)
- 다중 지점 지원
- 재고 관리 모듈
- 구매 관리 시스템
- API 게이트웨이

### 장기 확장 (1년+)
- 클라우드 배포 (AWS/Azure)
- 마이크로서비스 아키텍처
- PostgreSQL 마이그레이션
- 모바일 앱 (React Native)

## 운영 및 모니터링

### 로그 관리
- 애플리케이션 로그: `logs/` 디렉토리
- 에러 로그: 구조화된 JSON 형식
- 접근 로그: Express 미들웨어

### 백업 전략
- SQLite 데이터베이스: 일일 백업
- 업로드 파일: 원본 보존
- 설정 파일: 버전 관리

### 모니터링 지표
- 응답 시간 모니터링
- 메모리 사용량 추적
- 에러율 측정
- 사용자 활동 로그

## 개발 환경

### 개발 도구
- IDE: VS Code (권장)
- 디버깅: Node.js Inspector
- 버전 관리: Git
- 패키지 관리: npm

### 빌드 프로세스
```bash
# 개발 빌드
npm run dev-all  # 백엔드 + 프론트엔드 동시 실행

# 프로덕션 빌드
npm run build-client  # React 빌드
npm run build-win     # Windows 실행파일
npm run build-mac     # macOS 실행파일
```

## 라이선스 및 의존성

### 주요 라이브러리 라이선스
- Express.js: MIT License
- React: MIT License
- ExcelJS: MIT License
- SQLite3: Public Domain
- Electron: MIT License

### 상업적 사용
- 모든 의존성: 상업적 사용 가능
- 라이선스 충돌 없음
- 배포 제한 사항 없음

---
**문서 버전**: 1.0  
**최종 수정**: 2025-08-26  
**검토자**: Claude AI Development Team