# 백엔드 배포 스펙

## 실행 환경
- **실행 명령어**: `node server.js`
- **Node.js 버전**: 18+ 권장
- **포트**: `PORT` 환경변수 또는 기본 3001

## 필수 요구사항
### 퍼시스턴트 디스크 필요
- **SQLite 파일**: `./database/erp.db`
- **업로드 폴더**: `./uploads/`  
- **백업 폴더**: `./backups/`
- **최소 디스크**: 1GB

### 환경변수
```
PORT=3001
NODE_ENV=production
```

## 추천 배포 플랫폼
1. **Railway**: SQLite + 파일 시스템 완벽 지원
2. **Render**: 퍼시스턴트 디스크 옵션 있음
3. **DigitalOcean App**: 볼륨 마운트 가능

## 배포 설정 예시 (Railway)
```yaml
build:
  command: npm install
start:
  command: node server.js
healthcheck:
  path: /api/health
```

## 필요한 포트 공개
- **HTTP 포트**: 3001 (외부 접근 가능해야 함)
- **프론트엔드에서 API 호출**: `https://your-backend.railway.app`

## 파일 구조 확인
```
/
├── server.js          # 메인 서버
├── database.js        # DB 연결
├── database/          # SQLite 파일 저장
├── uploads/           # 업로드 파일 저장  
├── backups/           # 자동 백업 저장
├── scripts/           # 백업 스케줄러
└── package.json       # 의존성
```