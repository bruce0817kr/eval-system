# 인수인계서 (Handover Document)

**프로젝트**: 중소기업 지원사업 선정평가 시스템  
**버전**: 1.0  
**작성일**: 2026-04-02  
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
├── public/fonts/               # PDF 한글 폰트
├── docker-compose.yml          # 개발 환경
├── docker-compose.prod.yml     # 운영 환경
├── Dockerfile                 # 컨테이너 빌드
└── .env.example               # 환경변수 템플릿
```

---

## 4. 데이터베이스 모델 (17개)

| 모델 | 설명 |
|------|------|
| AdminUser | 관리자 계정 |
| CommitteeMember | 평가위원 |
| Company | 기업 정보 |
| EvaluationSession | 평가 회차 |
| SessionFormDefinition | 평가표 스냅샷 |
| Application | 기업 신청 정보 |
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

## 8. 주요 수정 이력 (2026-04-02)

### 코드 리뷰 후 수정 사항

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

### 9.3 OTP 설정
- 현재 CoolSMS/NHN Cloud 연동 대기
- SMS 발송 없이 OTP 검증 로직만 구현됨
- 실제 SMS 연동 시 `src/lib/auth/otp.ts` 수정 필요

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

## 12. 연락처

| 역할 | 담당 |
|------|------|
| 프로젝트 총괄 | Admin Team |
| 기술 지원 | DevOps Team |

---

*본 문서는 프로젝트 인수인계를 위해 작성되었으며, 긴급 수정 시 기존 패턴을 참고하여 처리 가능*
