# 제이에스일렉트로닉 프로젝트 에셋 관리 지침

## 에셋 구조
```
assets/
├── data/             # 샘플 데이터, Excel 템플릿
├── images/           # UI 이미지, 로고
├── documents/        # 사용자 매뉴얼, 가이드
└── templates/        # Excel 템플릿, 보고서 양식
```

## 파일명 규칙

### 데이터 파일
```
용도_날짜_버전.확장자
예: sales_template_v1.xlsx
    customer_sample_20250724.csv
    report_format_v2.xlsx
```

### 문서 파일
```
문서종류_제목_날짜.확장자
예: manual_user_guide_20250724.pdf
    guide_excel_upload_v1.docx
```

## 데이터 템플릿 관리

### Excel 템플릿
- **매출 데이터**: sales_template.xlsx
- **거래처 정보**: customer_template.xlsx
- **재고 현황**: inventory_template.xlsx
- **월간 보고서**: monthly_report_template.xlsx

### 템플릿 규격
- 헤더는 첫 번째 행에 위치
- 날짜 형식: YYYY-MM-DD
- 금액 형식: 천 단위 구분
- 인코딩: UTF-8

## 샘플 데이터 관리

### 테스트 데이터
- 실제 데이터와 유사한 구조
- 민감 정보는 마스킹 처리
- 최소 100건 이상의 샘플

### 데이터 보안
```
원본: 홍길동 → 마스킹: 홍**
원본: 010-1234-5678 → 마스킹: 010-****-5678
원본: ABC전자 → 마스킹: A**전자
```

## 이미지 에셋

### UI 요소
- **아이콘**: 24x24, 48x48 px
- **로고**: SVG 권장, PNG 대체
- **버튼**: 적절한 패딩 포함

### 스크린샷
- 사용 설명서용 스크린샷
- 주요 기능별 캡처
- 화살표, 설명 추가

## 문서 관리

### 사용자 매뉴얼
- PDF 형식 권장
- 목차 포함
- 스크린샷 포함
- 버전 정보 명시

### 업데이트 내역
```markdown
## 변경 이력
- v1.0 (2025-07-24): 초기 버전
- v1.1 (2025-08-01): 기능 추가
```

## 파일 구조 예시
```
assets/
├── data/
│   ├── samples/
│   │   ├── sales_sample_202507.xlsx
│   │   └── customer_sample.csv
│   └── templates/
│       ├── sales_template_v2.xlsx
│       └── report_template.xlsx
├── images/
│   ├── logo/
│   │   └── js_electronics_logo.svg
│   ├── icons/
│   │   ├── upload_icon.png
│   │   └── download_icon.png
│   └── screenshots/
│       └── main_dashboard.png
└── documents/
    ├── manual_user_v1.pdf
    └── guide_quickstart.pdf
```

## 백업 정책
- 템플릿 변경 시 이전 버전 보관
- 중요 문서는 클라우드 백업
- 월 1회 전체 백업

---
최종 업데이트: 2025-07-24