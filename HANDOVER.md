# 인수인계서 - QA 이슈 수정 및 기능 구현

**최초 작성**: 2026-04-03  
**최종 업데이트**: 2026-04-11  
**다음 작업자**: 개발팀

---

## 1. 완료된 작업 (2026-04-11 기준)

### 1.1 보안

| 항목 | 내용 |
|------|------|
| 로그인 rate limiting | IP당 10회/15분 초과 시 429, Redis 기반 (`src/lib/auth/rate-limit.ts`) |
| register bootstrap | admin 없으면 최초 생성 허용, 있으면 admin 세션 필요 |
| 비밀번호 최소 길이 | 6자 → 8자 |

### 1.2 버그 수정

| 파일 | 수정 내용 |
|------|-----------|
| `aggregate/route.ts` | 재개방 후 재집계 시 lastReopen 기준 스코프 적용, create→upsert |
| `results/route.ts` | 결과 순위 정렬 추가, 죽은 분기 제거 |
| `results-tab-content.tsx` | AlertDialog controlled state (확정 클릭 후 다이얼로그 닫힘), 0나누기 방지 |
| `status/route.ts` | finalize 시 집계 미실행이면 "집계를 먼저 실행해주세요" 에러 반환 |

### 1.3 신규 API

| 엔드포인트 | 기능 |
|-----------|------|
| `GET /api/admin/me` | 현재 로그인 admin 정보 반환 (JWT에서 추출) |
| `POST /api/admin/auth/password` | 비밀번호 변경, 성공 시 admin_session 쿠키 삭제 |
| `GET /api/admin/audit-log` | 감사 로그 목록 (페이지네이션, 필터) |
| `GET/PATCH/DELETE /api/admin/sessions/[id]/applications/[id]` | 신청 상세/상태변경/삭제 |
| `GET /api/admin/sessions/[id]/submissions` | 세션 제출 목록 |

### 1.4 신규 페이지/컴포넌트

| 항목 | 설명 |
|------|------|
| `/admin/settings` | 비밀번호 변경 폼, 성공 후 1.5초 뒤 `/admin/login` 리다이렉트 |
| `CompanyCreateDialog` | 기업 등록 다이얼로그 |
| `CompanyEditDialog` | 기업 수정 다이얼로그 |
| `CommitteeAssignDialog` | 평가위원 배정 다이얼로그 (검색/선택/위원장 지정) |
| `DocumentDialog` | 서류 관리 (업로드/다운로드/삭제 AlertDialog) |
| `ResultsTabContent` | 결과 탭 (집계/확정) |
| layout.tsx 사이드바 | `/api/admin/me` fetch로 실제 admin 이름/이메일 표시 |

### 1.5 E2E 테스트

- `eval-signature.spec.ts`: 전체 UI 플로우 + 중복 제출 방지 API 검증 2개 구현
- `helpers.ts`: `clearSubmissions(memberId, sessionId)`, `clearAdminRateLimit()` 헬퍼 추가

### 1.6 2차 수정 (2026-04-10 2차)

| 파일 | 수정 내용 |
|------|-----------|
| `evaluate/[applicationId]/page.tsx` | `SignatureSubmitDialog`를 `next/dynamic({ ssr: false })`로 동적 로드 — `signature_pad`가 SSR에서 `DOMMatrix is not defined` 에러 유발 |
| `signature-submit-dialog.tsx` | `signatureDataUrlRef` 추가 — Step 2→3 전환 시 서명 데이터 캡처 후 OTP 제출 시 ref 사용 (비동기 OTP 처리 중 SignaturePad 인스턴스 stale 문제 해결) |
| `request-otp/route.ts` & `verify-otp/route.ts` | Prisma WASM 컴파일러 버그 우회 — `prisma.committeeMember.findFirst` → raw `pg.Pool` 직접 쿼리 |
| `admin/auth/login/route.ts` & `verify-otp/route.ts` | 쿠키 `secure` 플래그: `NODE_ENV === 'production'` → `request.url.startsWith('https://')` |
| `scripts/setup-test-data.mjs` | 컨테이너명 `eval-postgres-1`→`eval-postgres`, `eval-minio-1`→`eval-minio`; 전화번호 `01011111111`→`01022222222`; camelCase 컬럼명 수정 |
| `playwright.config.ts` | `workers: undefined` → `workers: 1` (로컬도 단일 워커 강제) |
| `tests/helpers.ts` | `clearRedisOTP`에 `otp:rate:*` 키 추가 삭제; `clearAdminRateLimit()` 신규; `clearSubmissions`에 `signature_artifact` 선행 삭제 + camelCase 컬럼명 |
| `tests/eval-admin.spec.ts` | `beforeEach`에 `clearAdminRateLimit()` 추가 |
| `tests/eval-evaluation.spec.ts` | 세션 카드 텍스트 일어 → 한국어 (`2026년 상반기 기술평가`) |
| `tests/eval-signature.spec.ts` | 전화번호 업데이트; 제출 버튼 셀렉터 개선; SignaturePad 초기화 2000ms 대기; OTP 클리어 순서 수정 |

---

## 2. E2E 테스트 인프라

### 2.1 테스트 파일 구조

```
tests/
├── page-objects.ts          # Playwright POM 정의
├── helpers.ts               # Redis OTP + DB 클린업 유틸리티
├── eval-login.spec.ts       # 평가위원 OTP 로그인 (2 passed, 2 skipped)
├── eval-evaluation.spec.ts  # 평가 플로우 (3 passed)
├── eval-signature.spec.ts   # 서명 제출 + 중복방지 (2 passed)
└── eval-admin.spec.ts       # 관리자 기능 (6 passed)
```

### 2.2 테스트 데이터

| 구분 | 값 |
|------|-----|
| 테스트 평가위원 | 김평가 (`test-member-e2e`, phone: 01022222222) |
| 평가 세션 | `test-session-e2e` (2026년 상반기 기술평가) |
| 신청 번호 | `app-test-session-e2e` (app001~app010) |
| 관리자 계정 | testadmin@test.com / TestAdmin123! |
| auditor 계정 | auditor@test.com / Auditor123! |

### 2.3 테스트 실행

```bash
# 테스트 데이터 초기화 (필수)
node scripts/setup-test-data.mjs

# 전체 실행
npx playwright test --workers=1 --timeout=60000

# 특정 파일만
npx playwright test tests/eval-admin.spec.ts --workers=1

# Redis OTP/rate limit 클리어 (필요 시)
docker exec eval-redis-1 redis-cli -p 6379 KEYS "otp:*" | xargs docker exec eval-redis-1 redis-cli -p 6379 DEL
docker exec eval-redis-1 redis-cli -p 6379 KEYS "admin:login:rate:*" | xargs docker exec eval-redis-1 redis-cli -p 6379 DEL
```

---

## 3. Docker 운영

현재 앱 컨테이너(`eval-app-1`)는 `docker run`으로 직접 관리 중 (docker-compose와 별개).

```bash
# 이미지 재빌드
docker build -t eval-app-local .

# 컨테이너 교체
docker stop eval-app-1 && docker rm eval-app-1
docker run -d \
  --name eval-app-1 \
  --network eval_default \
  -p 3003:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://eval:eval_secret@eval-postgres:5432/eval_db \
  -e REDIS_URL=redis://eval-redis-1:6379 \
  -e AUTH_SECRET=change-this-to-a-random-secret-in-production \
  -e S3_ENDPOINT=http://eval-minio:9000 \
  -e S3_ACCESS_KEY=minioadmin \
  -e S3_SECRET_KEY=minioadmin \
  -e S3_BUCKET=eval-documents \
  -e S3_REGION=us-east-1 \
  -e OCTOMO_API_KEY=<키값> \
  -e OCTOMO_TARGET_NUMBER=1666-3538 \
  eval-app-local

# 컨테이너 상태 확인
docker ps --filter "name=eval"
```

> **주의**: `docker compose up` 실행 시 eval-postgres가 삭제될 수 있음.
> postgres가 꺼지면: `docker compose up -d postgres` (메인 compose로 복구)

---

## 4. 알려진 이슈

### 4.1 관리자 로그인 Playwright 테스트

- react-hook-form controlled input이 Playwright `fill` 인식 불가
- 해결: API 직접 호출로 인증 (`adminLogin()` 헬퍼)

### 4.2 스킵된 테스트

- `eval-login.spec.ts` 2개: OCTOMO API OTP 검증 의존
- 실제 운영에서는 OCTOMO SMS OTP 수신 필요

---

## 5. 환경 변수

```
DATABASE_URL=postgresql://eval:eval_secret@eval-postgres:5432/eval_db
REDIS_URL=redis://eval-redis-1:6379
AUTH_SECRET=change-this-to-a-random-secret-in-production   # 운영 전 반드시 교체
OCTOMO_API_KEY=<별도 보관>
OCTOMO_TARGET_NUMBER=1666-3538
S3_ENDPOINT=http://eval-minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=eval-documents
S3_REGION=us-east-1
```
</content>
</invoke>

---

## 2026-04-16 REST API 연동/평가 시뮬레이션 인수인계

### 완료
- 사업관리 시스템 연동용 REST API v1 추가
  - `PUT /api/v1/integration/sessions/[externalSessionId]`
  - `PUT /api/v1/integration/sessions/[externalSessionId]/applications`
  - `GET /api/v1/integration/sessions/[externalSessionId]/results`
- 연동 인증 추가
  - `Authorization: Bearer <INTEGRATION_API_KEY>`
  - 개발 기본값: `.env.local`의 `INTEGRATION_API_KEY="test-integration-key"`
- OpenAPI 명세 추가: `docs/api/integration-openapi.yaml`
- 평가위원 신청서/PDF 확인 UX 보강
  - PDF 문서 파일명을 버튼으로 노출
  - 문서 선택 시 같은 뷰어에서 렌더링
  - signed 상태 평가표는 본인 답변/코멘트/배점 확인 가능, 수정/재제출 불가
- 결과 내보내기 보강
  - PDF export를 Windows dev 환경에서 깨지던 `pdfkit` 기본 폰트 의존 없이 응답하도록 단순화
  - Excel export 파일명을 ASCII 안전 값으로 변경
- 집계/로그인 결함 수정
  - 평가위원 OTP raw SQL 컬럼명 `is_active` -> `"isActive"`
  - 집계가 실제 제출 구조 `scoresJson.perItem[*].weightedScore`를 반영하도록 수정
- Docker Postgres 호스트 포트 충돌 회피
  - `docker-compose.yml` Postgres 포트: `15432:5432`

### 검증
- `npx playwright test tests/integration-api.spec.ts --workers=1` -> 2 passed
- `npx playwright test tests/eval-full-simulation.spec.ts --workers=1` -> 1 passed
- `npx playwright test tests/eval-full-simulation.spec.ts tests/integration-api.spec.ts --workers=1` -> 3 passed
- 변경 파일 한정 ESLint -> 0 errors
- `npm run build` -> success

### 남은 리스크
- 전체 `npm run lint`는 기존 저장소 lint 오류 때문에 아직 실패한다.
- `docs/api/integration-openapi.yaml`은 최소 연동 API 명세이며, 문서 업로드 연동 API와 webhook/callback 명세는 다음 단계로 남아 있다.
- 결과 PDF는 안정 응답을 우선한 단순 PDF다. 한글 리포트 품질/서식은 별도 개선 필요.

### 2026-04-16 추가 정리
- untracked 임시파일/리포트/도구 상태 정리
  - `playwright-report/`, `test-results/`, `.omx/`, `.planning/`, `.claude/`, 임시 SQL/업로드/로그 파일 제거
  - 유지 대상: `tests/eval-api-coverage.spec.ts`는 API 회귀 테스트로 커밋
- 전체 lint 오류 해결
  - `npm run lint` -> 0 errors
  - 남던 hook dependency, `module` 변수명, 테스트 fixture `use` 오탐, unused import/variable 정리
- 검증
  - `npm run lint` -> success
  - `npx playwright test tests/eval-full-simulation.spec.ts tests/integration-api.spec.ts tests/eval-api-coverage.spec.ts --workers=1` -> 21 passed
  - `npm run build` -> success

### 2026-04-16 문서 업로드 연동 API 추가
- 추가 endpoint
  - `POST /api/v1/integration/applications/[externalApplicationId]/documents`
  - 인증: `Authorization: Bearer <INTEGRATION_API_KEY>`
  - 요청: `multipart/form-data`, `file` 필수, `docType=business_plan|supplementary`
  - 현재 PDF만 허용
- OpenAPI 갱신
  - `docs/api/integration-openapi.yaml`
  - `DocumentUploadRequest`, `DocumentUploadResponse`, `DocumentItem`, `ExternalApplicationId` 추가
- 검증
  - `npx playwright test tests/integration-api.spec.ts tests/eval-api-coverage.spec.ts tests/eval-full-simulation.spec.ts --workers=1` -> 21 passed
  - `npm run lint` -> success
  - `npm run build` -> success

### 2026-04-16 idempotency/webhook 보강
- 문서 업로드 연동 API 재시도 안전성 추가
  - `Idempotency-Key` 헤더 지원
  - 같은 application + key 재요청 시 기존 document 반환(200)
  - 신규 업로드 시 201
- 평가 확정 webhook 추가
  - `INTEGRATION_WEBHOOK_URL` 설정 시 `evaluation.finalized` 이벤트 POST
  - 개발/테스트 기본 수신 URL: `http://127.0.0.1:3999/integration-webhook`
  - payload: `sessionId`, `title`, `status`, `finalizedAt`, `selectedApplications`
- OpenAPI 갱신
  - `Idempotency-Key` header parameter 추가
  - `webhooks.evaluationFinalized` 명세 추가
- 검증
  - `npx playwright test tests/integration-api.spec.ts tests/eval-api-coverage.spec.ts tests/eval-full-simulation.spec.ts --workers=1` -> 21 passed
  - `npm run lint` -> success
  - `npm run build` -> success

### 2026-04-16 webhook 서명/재시도 추가 보강
- finalized webhook delivery 강화
  - `eventId` payload 필드 추가
  - `X-Event-Id` 헤더 추가
  - `X-Signature: sha256=<hmac>` 헤더 추가
  - 서명 secret: `INTEGRATION_WEBHOOK_SECRET` 우선, 없으면 `AUTH_SECRET`
  - 비 2xx 응답 또는 네트워크 실패 시 최대 3회 재시도
- OpenAPI 갱신
  - finalized webhook header 명세 추가
  - webhook payload `eventId` 필수화
- 검증
  - `npx playwright test tests/eval-full-simulation.spec.ts --workers=1` -> 1 passed
  - `npx playwright test tests/eval-full-simulation.spec.ts tests/integration-api.spec.ts --workers=1` -> 3 passed
  - `npx playwright test tests/integration-api.spec.ts tests/eval-api-coverage.spec.ts tests/eval-full-simulation.spec.ts --workers=1` -> 21 passed
  - `npm run lint` -> success
  - `npm run build` -> success

### 2026-04-16 webhook delivery log/replay 추가
- persistent delivery log 추가
  - `integration_webhook_delivery` 테이블을 필요 시 자동 생성
  - 저장 항목: `event_id`, `event_type`, `url`, `payload_json`, `status`, `attempts`, `last_status`, `last_error`, `delivered_at`
- replay API 추가
  - `POST /api/v1/integration/webhooks/[eventId]/replay`
  - 인증: `Authorization: Bearer <INTEGRATION_API_KEY>`
  - 기존 payload와 event id로 webhook 재전송
- OpenAPI 갱신
  - replay endpoint 및 `WebhookReplayResponse` 추가
- 검증
  - `npx playwright test tests/eval-full-simulation.spec.ts --workers=1` -> 1 passed
  - `npx playwright test tests/integration-api.spec.ts tests/eval-api-coverage.spec.ts tests/eval-full-simulation.spec.ts --workers=1` -> 21 passed
  - `npm run lint` -> success
  - `npm run build` -> success

### 2026-04-16 webhook delivery 관리자 화면/API 추가
- 관리자 API
  - `GET /api/admin/integration/webhooks`
    - delivery log 목록 조회
    - operator 이상 권한 필요
  - `POST /api/admin/integration/webhooks/[eventId]/replay`
    - 관리자 권한으로 webhook 재전송
- 관리자 화면
  - `/admin/integration/webhooks`
  - event id, 상태, attempts, last response, updated time 표시
  - Replay 버튼 제공
- delivery log helper
  - `listIntegrationWebhookDeliveries()` 추가
- 검증
  - `npx playwright test tests/eval-full-simulation.spec.ts --workers=1` -> 1 passed
  - `npx playwright test tests/integration-api.spec.ts tests/eval-api-coverage.spec.ts tests/eval-full-simulation.spec.ts --workers=1` -> 21 passed
  - `npm run lint` -> success
  - `npm run build` -> success

### 2026-04-16 webhook 운영 하드닝 후속
- 관리자 메뉴 연결
  - `/admin/integration/webhooks`를 관리자 사이드바에 추가
- delivery 목록 필터/페이지네이션 추가
  - `GET /api/admin/integration/webhooks?page=&pageSize=&status=`
  - `status`: `pending | delivered | failed`
  - 화면에 Status filter, Previous/Next 표시
- delivery table 정식 스키마 기록
  - `prisma/schema.prisma`에 `IntegrationWebhookDelivery` 모델 추가
  - `prisma/migrations/202604160001_add_integration_webhook_delivery/migration.sql` 추가
- PDF viewer warning 정리
  - `react-pdf/dist/Page/TextLayer.css` import 추가
- 검증
  - `npx playwright test tests/eval-full-simulation.spec.ts --workers=1` -> 1 passed
  - `npx playwright test tests/integration-api.spec.ts tests/eval-api-coverage.spec.ts tests/eval-full-simulation.spec.ts --workers=1` -> 21 passed
  - `npm run lint` -> success
  - `npm run build` -> success

### 2026-04-16 migration/runtime bootstrap 정리
- runtime table bootstrap 제거
  - `src/lib/integration/webhook.ts`에서 `CREATE TABLE IF NOT EXISTS` 제거
  - delivery table은 migration으로 관리
- package scripts 추가
  - `npm run db:generate`
  - `npm run db:migrate:deploy`
- 로컬 DB 처리
  - 기존 non-empty DB라 `npx prisma migrate deploy`는 `P3005` 발생
  - 현재 로컬 DB는 `npx prisma migrate resolve --applied 202604160001_add_integration_webhook_delivery`로 적용 기록 처리함
- 배포 절차
  - 신규/배포 DB에서는 `DATABASE_URL=<...> npm run db:migrate:deploy`
  - 이후 `npm run db:generate`, `npm run build`
- 검증
  - `npx playwright test tests/eval-full-simulation.spec.ts tests/integration-api.spec.ts --workers=1` -> 3 passed
  - `npm run lint` -> success
  - `npm run build` -> success
  - `npm run db:generate` -> success

### 2026-04-16 integration 운영 문서/명세 검증 추가
- fresh DB migration 검증
  - 임시 DB `eval_migrate_verify` 생성
  - `DATABASE_URL=postgresql://eval:eval_secret@localhost:15432/eval_migrate_verify npm run db:migrate:deploy` 성공
  - `integration_webhook_delivery` 생성 및 `_prisma_migrations` 기록 확인
  - 검증 후 임시 DB 삭제
- OpenAPI 명세 체크 스크립트 추가
  - `npm run api:spec:check`
  - `scripts/validate-openapi.mjs`
  - 주요 integration endpoint/schema/webhook/header 존재 여부 검사
- 연동 예시 문서 추가
  - `docs/api/integration-examples.md`
  - 세션 upsert, 신청기업 upsert, PDF 업로드, 결과 조회, webhook replay, finalized webhook payload, 배포 체크리스트 포함
- 검증
  - `npm run api:spec:check` -> success
  - `npx playwright test tests/integration-api.spec.ts tests/eval-api-coverage.spec.ts tests/eval-full-simulation.spec.ts --workers=1` -> 21 passed
  - `npm run lint` -> success
  - `npm run build` -> success

### 2026-04-16 webhook delivery Prisma client 전환
- `integration_webhook_delivery` 접근을 Prisma client 기반으로 전환
  - raw SQL insert/update/select 제거
  - `prisma.integrationWebhookDelivery.upsert/update/findMany/count` 사용
- Prisma schema field mapping 수정
  - camelCase model field와 snake_case DB 컬럼을 `@map(...)`으로 연결
  - `eventId -> event_id`, `payloadJson -> payload_json`, `lastStatus -> last_status` 등
- Prisma client 재생성
  - `npm run db:generate`
- 검증
  - `npx playwright test tests/eval-full-simulation.spec.ts tests/integration-api.spec.ts --workers=1` -> 3 passed
  - `npx playwright test tests/integration-api.spec.ts tests/eval-api-coverage.spec.ts tests/eval-full-simulation.spec.ts --workers=1` -> 21 passed
  - `npm run lint` -> success
  - `npm run build` -> success
  - `npm run api:spec:check` -> success

### 2026-04-16 사업관리 MVP 명세 반영
- integration API 응답 envelope 적용
  - 성공: `{ status: "ok|created|updated", data: ... }`
  - 실패: `{ status: "failed|not_found", message, data: { code, details? } }`
  - validation 계열 오류는 422로 조정
- HMAC secret 환경변수명 반영
  - `INTEGRATION_WEBHOOK_HMAC_SECRET` 우선 사용
  - 기존 `INTEGRATION_WEBHOOK_SECRET`, `AUTH_SECRET` fallback 유지
- integration health endpoint 추가
  - `GET /api/v1/integration/health`
  - `{ status: "ok", data: { version: "v1", auth: "bearer", timestamp } }`
- webhook delivery 상세 API/화면 추가
  - `GET /api/admin/integration/webhooks/[eventId]`
  - `/admin/integration/webhooks/[eventId]`
- 검증
  - `npx playwright test tests/integration-api.spec.ts tests/eval-api-coverage.spec.ts tests/eval-full-simulation.spec.ts --workers=1` -> 22 passed
  - `npm run api:spec:check` -> success
  - `npm run lint` -> success
  - `npm run build` -> success

### 2026-04-17 사업관리 확인사항 추가 반영
- PDF 업로드 제한 구현
  - integration document upload 최대 50MB
  - 초과 시 `422` + `{ status: "failed", message: "PDF document exceeds the 50MB limit" }`
- webhook receiver dedup 요구사항 문서화
  - 사업관리 시스템은 `X-Event-Id`를 저장하고 중복 이벤트를 무시해야 함
- HMAC 환경변수명 정리
  - 문서 기준: `INTEGRATION_WEBHOOK_HMAC_SECRET`
- 검증
  - `npx playwright test tests/integration-api.spec.ts --workers=1` -> 3 passed
  - `npx playwright test tests/integration-api.spec.ts tests/eval-api-coverage.spec.ts tests/eval-full-simulation.spec.ts --workers=1` -> 22 passed
  - `npm run api:spec:check` -> success
  - `npm run lint` -> success
  - `npm run build` -> success

### 2026-04-17 연동 PoC 실행 도구 추가
- 스크립트 추가
  - `npm run integration:smoke`
    - `EVAL_BASE_URL`, `INTEGRATION_API_KEY`로 health/session/application/document/results 왕복 확인
  - `npm run integration:webhook:sample`
    - `WEBHOOK_URL`, `INTEGRATION_WEBHOOK_HMAC_SECRET`로 signed finalized webhook 샘플 발송
- 문서 추가
  - `docs/api/integration-examples.md`에 smoke test와 webhook sample sender 실행법 추가
- 검증
  - `node --check scripts/send-finalized-webhook-sample.mjs` -> success
  - `node --check scripts/integration-smoke-test.mjs` -> success
  - `npm run api:spec:check` -> success
  - `npx playwright test tests/integration-api.spec.ts tests/eval-api-coverage.spec.ts tests/eval-full-simulation.spec.ts --workers=1` -> 22 passed
  - `npm run lint` -> success
  - `npm run build` -> success

### 2026-04-17 일시 중단 지점
- 현재 상태
  - 선정평가 시스템 쪽 integration API, OpenAPI, smoke test, webhook sample sender 준비 완료
  - 사업관리 시스템 staging endpoint, token, webhook URL/secret 준비 대기
- 재개 조건
  - 사업관리 시스템의 staging base URL
  - 선정평가 호출용 `INTEGRATION_API_KEY`
  - 사업관리 webhook URL
  - `INTEGRATION_WEBHOOK_HMAC_SECRET`
  - 실제 `program`, `participant`, `support_case`, `attachment` payload 샘플
- 재개 시 첫 작업
  - `EVAL_BASE_URL=<staging> INTEGRATION_API_KEY=<token> npm run integration:smoke`
  - `WEBHOOK_URL=<biz-webhook> INTEGRATION_WEBHOOK_HMAC_SECRET=<secret> npm run integration:webhook:sample`
  - 실제 payload 샘플 기준 field mapping 확인
- 알려진 후순위
  - PDF 결과 보고서 품질 개선
  - webhook delivery UI 편의 기능 추가
  - 실제 운영 reverse proxy 50MB body limit 확인

### 2026-04-23 로컬 재개 검증 및 테스트 데이터 스크립트 복구
- 로컬 PoC 재개 순서 검증
  - `localhost:3003/api/health` -> 200, database connected
  - `npm run integration:smoke` -> health/session/application/document/results 왕복 성공
  - `WEBHOOK_URL=http://127.0.0.1:3999/integration-webhook/ INTEGRATION_WEBHOOK_HMAC_SECRET=local-smoke-secret node scripts/send-finalized-webhook-sample.mjs` -> local receiver 기준 200, `X-Event-Id`/`X-Signature`/payload 수신 확인
- `scripts/setup-test-data.mjs` 복구
  - raw `psql` 호출을 `execFileSync` 인자 배열 기반으로 변경해 SQL quoting 오류와 숨겨진 실패 제거
  - Prisma 7 현재 물리 컬럼명(`"sessionId"`, `"applicationId"`, `"committeeMemberId"` 등)에 맞게 cleanup/insert SQL 수정
  - `session_committee_assignment.id` 명시 삽입
  - MinIO alias 의존(`mc ls minio/`) 제거, S3 `HeadBucket`/`CreateBucket` API로 bucket 확인
- 검증
  - `node --check scripts/setup-test-data.mjs` -> success
  - `DATABASE_URL=postgresql://eval:eval_secret@localhost:15432/eval_db S3_ENDPOINT=http://localhost:9000 S3_ACCESS_KEY=minioadmin S3_SECRET_KEY=minioadmin S3_BUCKET=eval-documents S3_REGION=us-east-1 node scripts/setup-test-data.mjs` -> success, 테스트 PDF 업로드 성공
  - `npx playwright test tests/integration-api.spec.ts tests/eval-api-coverage.spec.ts tests/eval-full-simulation.spec.ts --workers=1` -> 21 passed, 1 skipped
- 다음 작업
  - 사업관리 시스템 staging base URL/token/webhook URL/HMAC secret/실제 payload 샘플을 받으면 staging 대상으로 `integration:smoke`와 webhook sample을 실행
  - 실제 `program`, `participant`, `support_case`, `attachment` payload 기준 field mapping 확인
