# 인수인계서 (Handover Document)

**프로젝트**: 중소기업 지원사업 선정평가 시스템  
**버전**: 1.2  
**작성일**: 2026-04-03  
**작성자**: AI Engineering Team

---

## 1. 프로젝트 개요

중소기업 지원사업 선정평가 시스템은 관리자와 평가위원이 평가プロセスを 수행하는 웹 애플리케이션입니다.

### 주요 기능

| 기능 | 설명 |
|------|------|
| 평가 회차 관리 | 회차 생성, 기업 등록, 평가표 설정 |
| CSV/Excel 대량 입력 | 기업 일괄 등록 |
| 평가위원 관리 | 위원 등록, 세션 배정 |
| 평가 수행 | 분할 화면 (PDF 70% + 평가표 30%) |
| 자동저장 | 30초마다 낙관적 잠금 기반 저장 |
| 디지털 서명 | OTP + 서명패드 기반 최종 제출 |
| 점수 집계 | 최소/최대 제외 평균, 3단계 동점 처리 |
| PDF/Excel 내보내기 | 평가결과 보고서 생성 |
| 관리자 대시보드 | 실시간 현황 모니터링 |

---

## 2. 기술 스택

| 구분 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router) |
| Database | PostgreSQL 16 |
| ORM | Prisma 7 |
| UI | shadcn/ui (Base UI) + Tailwind CSS |
| Auth | JWT (admin: cookie, evaluator: session) |
| File Storage | MinIO (S3 compatible) |
| Cache | Redis |
| Container | Docker + Docker Compose |

---

## 3. 디렉토리 구조

```
C:\Project\eval\
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (admin)/           # 관리자 포털 레이아웃
│   │   ├── (eval)/            # 평가위원 포털 레이아웃
│   │   └── api/                # API Routes
│   │       ├── admin/          # 관리자 API
│   │       └── eval/           # 평가위원 API
│   ├── components/              # React 컴포넌트
│   │   ├── ui/                # shadcn/ui 기본 컴포넌트
│   │   └── admin/              # 관리자 전용 컴포넌트
│   └── lib/                    # 유틸리티 & 설정
│       ├── auth/               # JWT 인증
│       ├── db.ts               # Prisma 클라이언트
│       └── storage.ts          # S3/MinIO 업로드
├── prisma/
│   └── schema.prisma           # Prisma 스키마 (17개 모델)
├── config/
│   └── postgres.conf          # PostgreSQL WAL 설정
├── scripts/
│   ├── backup.sh               # Docker 컨테이너용 백업
│   ├── host-backup.sh          # 호스트 머신용 백업
│   ├── restore.sh             # 복구 스크립트
│   └── crontab.example        # Cron 스케줄 예시
├── public/fonts/               # PDF 한글 폰트
├── docker-compose.yml          # 개발 환경
├── docker-compose.prod.yml     # 운영 환경
├── Dockerfile                 # 컨테이너 빌드
└── .env.example               # 환경변수 템플릿
```

---

## 4. 데이터베이스 모델 (18개)

| 모델 | 설명 |
|------|------|
| AdminUser | 관리자 계정 |
| CommitteeMember | 평가위원 |
| Company | 기업 정보 |
| EvaluationSession | 평가 회차 |
| SessionFormDefinition | 평가표 스냅샷 |
| Application | 기업 신청 정보 |
| ApplicationDocument | 기업 신청 서류 (PDF) |
| EvaluationDraft | 평가 초안 (자동저장) |
| EvaluationSubmission | 평가 제출 |
| SignatureArtifact | 서명 데이터 |
| ResultSnapshot | 집계 결과 스냅샷 |
| AggregationRun | 집계 실행 기록 |
| ImportBatch | 대량 가져오기 배치 |
| ImportRowError | 가져오기 오류 |
| AuditEvent | 감사 로그 |
| AdminAuditLog | 관리자 작업 로그 |
| CommitteeMemberAuditLog | 평가위원 작업 로그 |
| FormTemplate | 평가표 템플릿 |
| FormTemplateVersion | 템플릿 버전 |

---

## 5. 환경변수 설정 (.env)

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/evaldb"

# Authentication
AUTH_SECRET="minimum-64-characters-secret-key-for-hs256"

# Redis
REDIS_URL="redis://localhost:6379"

# S3/MinIO
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="your-access-key"
S3_SECRET_KEY="your-secret-key"
S3_BUCKET="eval-files"
S3_REGION="us-east-1"

# OTP (SMS)
OTP_API_KEY=""
OTP_API_SECRET=""
OTP_SENDER="07012345678"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## 6. Docker 배포

### 개발 환경
```bash
docker-compose up -d
```

### 운영 환경
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 헬스체크
```bash
curl http://localhost:3000/api/health
```

---

## 7. 빌드 및 실행

```bash
# 의존성 설치
npm install

# Prisma 클라이언트 생성
npx prisma generate

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 빌드된 앱 실행
npm start
```

---

## 8. 주요 수정 이력

### 2026-04-03 업데이트 (v1.2)

| # | 이슈 | 수정 파일 |
|---|------|----------|
| 1 | DB 백업 시스템 (WAL 아카이빙) | `config/postgres.conf`, `docker-compose.prod.yml` |
| 2 | PDF 문서 업로드 API | `api/admin/sessions/[sessionId]/applications/[applicationId]/documents/route.ts` |
| 3 | 호스트 머신 백업 스크립트 | `scripts/host-backup.sh`, `scripts/restore.sh` |
| 4 | PostgreSQL WAL 권한 수정 | `wal_archive` 볼륨 postgres:postgres 권한 |
| 5 | **OCTOMO 무료 SMS OTP 연동** | `otp.ts`, `verify-otp/route.ts`, `sign/route.ts` |
| 6 | **평가 UI 개선** | PDF 뷰어 페이지네비게이션, 평가표 섹션 완료 표시, 모바일 최적화 |
| 7 | **any 타입 제거** | `aggregate/route.ts`, `results/excel/route.ts`, `aggregations/page.tsx` |

### 2026-04-02 코드 리뷰 후 수정 사항

### 2026-04-02 코드 리뷰 후 수정 사항

| # | 이슈 | 수정 파일 |
|---|------|----------|
| 1 | Excel formula injection 방지 | `results/excel/route.ts` |
| 2 | PDF bufferPages 설정 | `results/pdf/route.ts` |
| 3 | 한글 폰트 embed (malgun → font-noto-cjk) | `Dockerfile`, `results/pdf/route.ts` |
| 4 | Aggregate transaction 원자성 | `aggregate/route.ts` |
| 5 | RBAC 적용 (operator 역할 요구) | `jwt.ts`, 민감 API routes |
| 6 | Docker healthcheck (wget → curl) | `Dockerfile`, `docker-compose.prod.yml` |
| 7 | 서비스 healthcheck 추가 | `docker-compose.prod.yml` |

---

## 9. 운영 시 주의사항

### 9.1 PDF 한글 폰트
- `font-noto-cjk` APK 패키지 설치로 한글 렌더링 가능
- 개발 환경: `malgun.ttf` (Windows)
- 운영 환경: 시스템 폰트 (`/usr/share/fonts/noto-cjk/`)

### 9.2 RBAC 역할
| 역할 | 권한 |
|------|------|
| admin | 전체 접근 |
| operator | 평가 운영 (집계, 내보내기 포함) |
| auditor | 읽기 전용 |

### 9.3 OTP 설정 (OCTOMO 무료 SMS)
- **OCTOMO API** 사용 (무료 MO 문자)
- 사용자가 1666-3538로 인증코드 SMS 전송
- 서버가 OCTOMO API로 수신 확인
- 월 10,000건 무료 (Beta)

**환경변수 설정**:
```bash
OCTOMO_API_KEY="your-api-key"
OCTOMO_TARGET_NUMBER="1666-3538"
```

**관련 파일**:
- `src/lib/auth/otp.ts` - `verifyOtpViaOctomo()`, `storeOtpForOctomo()`
- `src/app/api/eval/auth/request-otp/route.ts` - OTP 생성 + 코드 반환
- `src/app/api/eval/auth/verify-otp/route.ts` - OCTOMO API 검증

### 9.4 서명 원본성
- HMAC-SHA256 기반 canonical JSON 해시
- OTP + 서명 이미지 + 서버 봉인 조합
- 법적 효력 필요 시 전자서명법 준수 검토 필요

---

## 10. Git 브랜치 전략

```
main     ← 프로덕션 배포
develop  ← 개발 통합
feature/* ← 기능 개발
```

---

## 11. 향후 개선사항

1. **실시간 WebSocket 통신** - 평가 진행 상황 실시간 업데이트
2. **PDF 폰트 번들링** - Noto Sans Korean TTF Docker镜像 포함
3. **SMS OTP 연동** - CoolSMS/NHN Cloud 실제 연동
4. **이메일 알림** - 평가 할당, 완료 알림
5. **다국어 지원** - i18n 프레임워크 적용

---

## 13. DB 백업 시스템 (WAL 아카이빙)

### 13.1 개요
PostgreSQL WAL (Write-Ahead Logging) 기반 증분 백업 시스템.

### 13.2 백업 방식
| 유형 | 주기 | 설명 |
|------|------|------|
| Base Backup | 매일 02:00 | pg_basebackup 전체 백업 |
| WAL 아카이브 | 매 60초 | 변경분 실시간 아카이브 |
| 보존 | 7일 | 이전 백업 자동 정리 |

### 13.3 생성된 파일
| 파일 | 용도 |
|------|------|
| `config/postgres.conf` | PostgreSQL WAL 설정 |
| `scripts/backup.sh` | Docker 컨테이너용 백업 스크립트 |
| `scripts/host-backup.sh` | 호스트 머신용 백업 스크립트 |
| `scripts/restore.sh` | 복구 스크립트 |
| `scripts/crontab.example` | Cron 스케줄 설정 예시 |

### 13.4 PostgreSQL 설정
```bash
wal_level = replica
archive_mode = on
archive_command = 'cp %p /wal_archive/%f'
archive_timeout = 60
```

### 13.5 사용법
```bash
# 환경변수 설정
export S3_ACCESS_KEY=your_key
export S3_SECRET_KEY=your_secret
export PGPASSWORD=your_password

# 전체 백업 실행 (base + WAL + cleanup)
./scripts/host-backup.sh full

# WAL만 업로드
./scripts/host-backup.sh wal

# 오래된 백업 정리
./scripts/host-backup.sh cleanup

# 복구 가능한 백업 목록
./scripts/restore.sh list

# 특정 시점으로 복구
./scripts/restore.sh restore base-20260403-120000
```

### 13.6 MinIO 버킷 구조
```
eval-backups/
├── base/           # Base backup 저장
│   └── base-20260403-120000/
│       ├── backup_timestamp.txt
│       ├── backup_name.txt
│       └── pgdata/
└── wal/            # WAL 파일 아카이브
    └── 000000010000000000000001
```

---

## 14. PDF 문서 업로드 API

### 14.1 엔드포인트
```
POST   /api/admin/sessions/[sessionId]/applications/[applicationId]/documents
GET    /api/admin/sessions/[sessionId]/applications/[applicationId]/documents
DELETE /api/admin/sessions/[sessionId]/applications/[applicationId]/documents/[documentId]
```

### 14.2 제한사항
- 파일 형식: PDF만
- 최대 크기: 50MB

### 14.3 저장소
- MinIO 버킷: `eval-documents`

---

## 15. Docker 환경 구성 (2026-04-03 수정)

### 15.1 서비스 목록
| 서비스 | 포트 | 설명 |
|--------|------|------|
| app | 3003:3000 | Next.js 애플리케이션 |
| postgres | 5433:5432 | PostgreSQL 16 + WAL |
| redis | 6380:6379 | Redis 7 |
| minio | 9002:9000, 9003:9001 | MinIO S3 |

### 15.2 볼륨
| 볼륨 | 용도 |
|------|------|
| postgres_data | PostgreSQL 데이터 |
| redis_data | Redis 데이터 |
| minio_data | MinIO 데이터 |
| wal_archive | WAL 아카이브 (공유) |

### 15.3 헬스체크
```bash
# 전체 서비스 상태
docker compose -f docker-compose.prod.yml ps

# PostgreSQL 확인
docker exec eval-postgres-1 psql -U eval -d eval_db -c "SELECT 1;"

# MinIO 버킷 목록
docker exec eval-minio-1 mc ls minio/
```

---

## 16. E2E 테스트 인프라 (Playwright)

### 16.1 설정 파일
| 파일 | 용도 |
|------|------|
| `playwright.config.ts` | Playwright 설정 (Chrome, retries, reporters) |
| `tests/helpers.ts` | Redis OTP 조회, 대기 유틸리티 |
| `tests/page-objects.ts` | EvaluatorLoginPage Page Object Model |
| `tests/eval-login.spec.ts` | 로그인 E2E 테스트 |

### 16.2 npm 스크립트
```bash
npm test        # headless로 테스트 실행
npm run test:ui     # Playwright UI로 테스트 실행
npm run test:headed # headed 모드로 테스트 실행
```

### 16.3 환경변수 (.env.test.local)
```bash
E2E_EVALUATOR_PHONE=01011111111
E2E_EVALUATOR_NAME=김평가
OCTOMO_API_KEY=your-key
```

### 16.4 테스트 실행 전 준비
```bash
# 1. Playwright 브라우저 설치 (初回)
npx playwright install

# 2. 개발 서버 실행
npm run dev

# 3. 테스트 실행
npm test
```

---

## 17. 향후 개선사항

1. ~~**SMS OTP 연동**~~ - ✅ OCTOMO 무료 SMS 연동 완료 (2026-04-03)
2. ~~**중복 제출 방지**~~ - ✅ submit API에 existing submission check (2026-04-03)
3. ~~**서명 완료 후 리다이렉트**~~ - ✅ 서명 완료 시 목록 이동 (2026-04-03)
4. ~~**E2E 테스트 인프라**~~ - ✅ Playwright 설정 완료 (2026-04-03)
5. 실시간 WebSocket 통신 - 평가 진행 상황 실시간 업데이트
6. 관리자 템플릿 할당 UI - 세션 설정에서 평가표 템플릿 선택 UI
7. 이메일 알림 - 평가 할당, 완료 알림
8. 다국어 지원 - i18n 프레임워크 적용

---

## 18. 연락처

| 역할 | 담당 |
|------|------|
| 프로젝트 총괄 | Admin Team |
| 기술 지원 | DevOps Team |

---

*본 문서는 프로젝트 인수인계를 위해 작성되었으며, 긴급 수정 시 기존 패턴을 참고하여 처리 가능*
