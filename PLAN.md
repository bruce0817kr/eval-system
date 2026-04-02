# 중소기업 지원사업 선정평가 시스템 — 구축 계획서

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 목적 | 중소기업 지원사업 선정을 위한 평가위원회 평가 시스템 구축 |
| 대상 사용자 | 관리자(평가 구성/운영), 평가위원(평가 수행) |
| 핵심 가치 | 평가의 공정성, 투명성, 추적가능성, 원본 보존 |

---

## 2. 아키텍처

### 2.1 기술 스택

```
Next.js 15 (App Router) + TypeScript ← 단일 웹앱 (프론트/백 통합)
shadcn/ui + Tailwind CSS 4          ← UI 컴포넌트 + 스타일링
Prisma                               ← ORM + 마이그레이션
PostgreSQL 16                        ← RDB + JSONB (템플릿/스냅샷)
S3-compatible Object Storage         ← PDF/파일 저장 (private bucket)
react-pdf                            ← PDF 뷰어 (PDF.js 래핑)
Redis (선택)                         ← 세션 캐시, OTP rate limit
```

**단일 앱 구조를 선택한 이유:**
- 이 시스템의 핵심 리스크는 대규모 트래픽이 아니라 **권한, 감사, 문서 원본성, 상태 전이 일관성**
- 프론트/백 분리는 운영 복잡도만 높이고 초기에 얻는 이점이 적음
- 인증·권한·PDF 다운로드·서버 렌더링을 한 앱에 두는 것이 안전

### 2.2 시스템 구성도

```
┌─────────────────────────────────────────────────┐
│                   Next.js App                    │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ 관리자 포털    │  │ 평가위원 포털              │ │
│  │ /admin/*     │  │ /eval/*                  │ │
│  └──────┬───────┘  └──────────┬───────────────┘ │
│         │                      │                 │
│  ┌──────┴──────────────────────┴───────────────┐ │
│  │            API Layer (Route Handlers)        │ │
│  │  /api/admin/*       /api/auth/*              │ │
│  │  /api/eval/*        /api/export/*            │ │
│  └──────────┬──────────────────────────────────┘ │
│             │                                     │
│  ┌──────────┴──────────────────────────────────┐ │
│  │         Service Layer (서버 로직)             │ │
│  │  - 평가 세션 관리    - 파일 처리              │ │
│  │  - 점수 집계         - PDF 생성               │ │
│  │  - 감사 로그         - 인증/인가              │ │
│  └──┬──────────┬────────────────┬───────────────┘ │
│     │          │                │                  │
└─────┼──────────┼────────────────┼──────────────────┘
      │          │                │
  PostgreSQL  S3 Storage     Background Worker
              (PDF/파일)     (PDF생성, OTP, 대량Import)
```

### 2.3 PDF 처리

| 용도 | 방식 | 라이브러리 |
|------|------|-----------|
| 사업계획서 열람 | 프론트엔드 PDF 렌더링 | PDF.js |
| 평가서/결과표 출력 | 서버에서 HTML→PDF 생성 | Puppeteer/Playwright |
| 최종 평가서 PDF | 제출 시점에 생성하여 보관 | 위와 동일 |

**핵심 원칙:** 조회 시 재생성하지 않고, 확정 시점의 PDF를 별도 보관

### 2.4 전자서명

**1차 설계: 내부 증거형 전자서명 (확정)**

> 법적 효력은 nice-to-have로 분류됨. 내부 감사 증적 확보가 핵심 목적.
> HMAC seal로 무결성·부인방지를 보장하고, 향후 공인 전자서명(PAdES, 공동인증서 등) 요구 시 PKI/HSM 설계로 승격 가능하도록 인터페이스를 분리해 설계.

---

## 3. 데이터베이스 설계

### 3.1 ERD (핵심 엔터티)

```
admin_user                 committee_member
    │                           │
    │  evaluation_session       │
    ├───────────────┬───────────┤
    │               │           │
    │    session_committee_assignment
    │               │
    │    session_form_definition
    │    (회차별 고정 폼 스냅샷)
    │
    ├─── company
    │       │
    │    application ────── application_document
    │       │                   (사업계획서 PDF)
    │       │
    │    evaluation_draft
    │    evaluation_submission ── signature_artifact
    │       │
    │    result_snapshot
    │
    form_template
        │
    form_template_version (불변 JSON schema)

    audit_event (append-only, tamper-evident)
    import_batch / import_row_error
```

### 3.2 주요 테이블 정의

#### 관리자
```sql
admin_user
  id, email, password_hash, name, role(admin|operator|auditor),
  created_at, updated_at
```

#### 평가위원
```sql
committee_member
  id, name, phone, organization, position, field,
  is_active, created_at
```

#### 평가 회차
```sql
evaluation_session
  id, title, description, status(draft|open|in_progress|closed|finalized),
  committee_size(기본 5), trim_rule(exclude_min_max),
  form_template_version_id → session_form_definition으로 snapshot,
  created_by, created_at, opened_at, closed_at, finalized_at
```

#### 기업 및 신청
```sql
company
  id, name, ceo_name, business_number, address, phone, email,
  industry, founded_date, created_at

application
  id, session_id, company_id, evaluation_order(integer),
  status(registered|evaluating|completed|excluded),
  notes, created_at

application_document
  id, application_id, doc_type(business_plan|supplementary),
  storage_key, original_filename, mime_type, file_size, sha256,
  uploaded_by, uploaded_at
```

#### 평가위원 배정
```sql
session_committee_assignment
  id, session_id, committee_member_id,
  role(chair|member), assigned_at
```

#### 평가표 템플릿
```sql
form_template
  id, name, description, is_shared, created_by, created_at

form_template_version
  id, template_id, version_number, schema_json, -- 불변
  total_score, items_definition,
  created_at
  -- schema_json 예시:
  -- {
  --   "sections": [
  --     { "title": "사업성 평가", "weight": 40,
  --       "items": [
  --         { "id": "s1_q1", "type": "radio_score", "label": "...",
  --           "options": [{score:1,label:"매우 부족"},...],
  --           "weight": 10, "required": true },
  --         { "id": "s1_q2", "type": "text", "label": "평가의견",
  --           "required": true }
  --       ]
  --     }
  --   ]
  -- }
```

#### 회차별 폼 정의 (스냅샷)
```sql
session_form_definition
  id, session_id, form_template_version_id,
  schema_json,        -- 불변 스냅샷 (회차 오픈 시 고정)
  total_score,        -- 총점
  items_count,        -- 항목 수
  snapshot_at,        -- 스냅샷 생성 시각
  created_at
  -- UNIQUE(session_id) — 회차당 1개 폼 정의
```

#### 평가 수행
```sql
evaluation_draft  -- 자동저장 초안
  id, application_id, committee_member_id, session_id,
  answers_json, version(integer, optimistic locking),
  last_saved_at

evaluation_submission  -- 최종 제출 (불변)
  id, application_id, committee_member_id, session_id,
  submission_state(draft|submitted|signed|invalidated),
  answers_json, scores_json, total_score,
  form_snapshot_id → session_form_definition.id,
  submitted_at, signed_at,
  ip_address, user_agent,
  is_valid(boolean), -- 재개방 등으로 무효화 가능
  invalidated_reason, invalidated_at,
  created_at
  -- CONSTRAINT: submission_state='signed' ↔ is_valid=true
  -- CONSTRAINT: submission_state='invalidated' ↔ invalidated_reason NOT NULL
```

signature_artifact
  id, submission_id,
  signature_image_storage_key,
  otp_verified(boolean), otp_phone,
  canonical_json_hash,
  pdf_hash,
  signer_id, signer_name,
  signed_at, ip_address, user_agent,
  server_seal, server_seal_algorithm,
  created_at  -- 불변
```

#### 결과 집계
```sql
result_snapshot
  id, application_id, session_id,
  raw_scores_json,        -- 전체 점수 목록
  trimmed_scores_json,    -- min/max 제외 후
  final_score,            -- 최종 평균
  rank,                   -- 순위
  tie_break_note,         -- 동점 처리 기록
  computed_at, computed_by,
  finalized_at  -- 확정 시 불변
```

#### 감사 로그 (append-only)
```sql
audit_event
  id, occurred_at,
  actor_type(admin|committee_member|system),
  actor_id,
  action(login|logout|view|submit|sign|reopen|finalize|import|export|...),
  target_type, target_id,
  session_id(nullable),
  request_id,
  ip_address, user_agent,
  payload_json,
  previous_hash,
  event_hash  -- hash(core_fields + previous_hash)
```

#### 대량 입력
```sql
import_batch
  id, session_id, filename, storage_key, total_rows,
  success_count, error_count, status,
  imported_by, imported_at

import_row_error
  id, batch_id, row_number, row_data_json, error_message
```

### 3.3 상태 전이 (State Machine)

#### 평가 회차
```
draft → open → in_progress → closed → finalized
                   ↑              │
                   └── reopened ←─┘ (사유 필요)
```

#### 신청 건
```
registered → evaluating → completed → excluded(제외)
```

#### 평가 제출
```
drafting → submitted → signed → (불변)
                         ↑
                    reopened (기록 남음, 기존 제출은 is_valid=false)
```

---

## 4. 화면 설계

### 4.1 관리자 포털 (/admin/*)

| 페이지 | 기능 |
|--------|------|
| 대시보드 | 진행 중/예정/완료 회차 현황, 통계 |
| 평가 회차 관리 | 회차 CRUD, 상태 변경, 기본 설정 |
| 기업 데이터 입력 | CSV/Excel 업로드, 개별 수정, 순서 지정 |
| 문서 등록 | 사업계획서 PDF 업로드, 미리보기 |
| 평가위원 관리 | 위원 등록/수정, 회차별 배정 |
| 평가표 템플릿 | 기본 템플릿 → 복사 → 수정 → 저장 → 공유 |
| 결과 관리 | 점수 집계, 순위 확인, 결과 확정 |
| 출력 | 평가서/결과표 PDF 생성, 다운로드 |
| 감사 로그 | 전체 활동 로그 조회 |
| Import 내역 | 업로드 이력, 오류 확인 |

### 4.2 평가위원 포털 (/eval/*)

| 페이지 | 기능 |
|--------|------|
| 로그인 | 이름 + 전화번호 + SMS OTP |
| 평가 목록 | 배정받은 회차/기업 목록, 진행 상태 |
| **평가 수행** | **핵심 화면 — 아래 상세** |
| 이력 | 본인 평가 이력 확인 |

#### 핵심: 평가 수행 화면

```
┌───────────────────────────────────────────────────────┐
│ [기업명] ㅇㅇ기업    [진행상황] 3/15    [화면비율 조정] │
├─────────────────────────────┬─────────────────────────┤
│                             │ 평가표                   │
│                             │                         │
│    사업계획서 PDF            │ ┌─ 1. 사업성 평가 ─────┐ │
│    (PDF.js 렌더링)           │ │ ○ 1점 ○ 2점 ● 3점  │ │
│                             │ │ ○ 4점 ○ 5점         │ │
│                             │ │ 평가의견:            │ │
│                             │ │ [____________]       │ │
│                             │ └──────────────────────┘ │
│         70%                 │ ┌─ 2. 기술성 평가 ─────┐ │
│                             │ │ ○ 1점 ○ 2점 ○ 3점  │ │
│                             │ │ ...                  │ │
│                             │ └──────────────────────┘ │
│                             │ [초안저장] [최종제출]     │
│                             │ ← 드래그 핸들 →         │
│                             │         30%             │
└─────────────────────────────┴─────────────────────────┘
```

- **좌측 70%:** PDF.js 기반 문서 뷰어 (읽기 전용)
- **우측 30%:** Schema-driven 평가 폼 (라디오 점수 + 주관식)
- **드래그 핸들:** 비율 조정 가능 (CSS resize 또는 라이브러리)
- **자동저장:** 초안을 주기적으로 저장 (optimistic locking)
- **최종 제출:** OTP 재확인 → 서명 → 불변 저장

### 4.3 반응형/인쇄 대응

- 평가 수행 화면은 태블릿(1024px+) 최적화
- 인쇄용 CSS 별도 정의 (평가표, 결과표)
- 출력물은 A4 기준 페이지 레이아웃

---

## 5. 핵심 기능 명세

### 5.1 CSV/Excel 대량 입력

```
1. 관리자가 CSV/Excel 파일 업로드
2. 서버에서 파싱 → 미리보기 (매핑 확인)
3. 검증 (필수 필드, 형식, 중복)
4. 일괄 저장 → import_batch, import_row_error 기록
5. 오류 건은 별도 표시 → 개별 수정 가능
```

### 5.2 평가표 템플릿 관리

```
기본 템플릿 (시스템 제공)
  → 복사 → 수정 (항목 추가/삭제, 가중치 변경, 점수 범위 조정)
  → 저장 → 새 버전 생성 (form_template_version)
  → 공유 설정 (다른 관리자도 사용 가능)
  → 회차에 적용 → session_form_definition으로 스냅샷 고정
```

지원 항목 타입:
- `radio_score`: 라디오 버튼 점수 (1~5점 등)
- `text`: 주관식 텍스트
- `section`: 섹션 구분
- `heading`: 제목
- `weight`: 항목별 가중치
- `signature_field`: 서명 필드

### 5.3 점수 집계 및 순위 산정

#### 집계 프로세스

```
입력: 각 application에 대한 evaluation_submission 점수 모음
알고리즘:
  1. 해당 application의 모든 유효 submission 수집
     (submission_state='signed' AND is_valid=true)
  2. committee_size와 실제 제출 수 비교
  3. 최고점(min)과 최저점(max) 제외
  4. 나머지 점수의 평균 = final_score
  5. 동점 시 동점 처리 규칙 적용 (설정 가능)
  6. 순위(rank) 산정
  7. result_snapshot에 저장
```

#### 집계 정책 (세부 규칙)

| 항목 | 규칙 | 비고 |
|------|------|------|
| **최소 제출 수** | committee_size의 과반(ceil(N/2)) 미만 시 집계 불가 | 과반 미달 시 "집계 대기" 상태 |
| **최소최대 제외** | trim_rule=`exclude_min_max` (기본값) | 3인 이하 위원회에서는 제외하지 않음 |
| **동점 처리** | 1순위: 가중치 항목별 비교 → 2순위: 원점수 합 → 3순위: 공동 순위 | 회차 설정에서 변경 가능 |
| **반올림** | 소수점 둘째 자리에서 반올림 (소수점 첫째 자리까지 표시) | `ROUND(score, 1)` |
| **기피/제외 건** | 집계에서 제외, 별도 표시 | 유효 제출 수에서 차감 |
| **재개방 후 재집계** | 기존 result_snapshot 무효화, 재집계 | aggregation_run으로 추적 |

#### 집계 추적성 (aggregation_run)

```sql
aggregation_run
  id, session_id,
  trigger_type(auto|manual|reopen),
  trigger_reason,
  applications_count,
  success_count, error_count,
  computed_by, computed_at,
  result_json  -- 집계 결과 요약
```

- 모든 집계 실행을 기록하여 추적성 확보
- 재집계 시 이전 run과의 diff 자동 생성

### 5.4 인증 및 권한

| 역할 | 인증 방식 | 권한 |
|------|----------|------|
| 관리자 (admin) | 이메일 + 비밀번호 (+ MFA 권장) | 전체 관리 기능 |
| 운영자 (operator) | 이메일 + 비밀번호 | 회차 운영, 출력 (설정 변경 불가) |
| 감사 (auditor) | 이메일 + 비밀번호 | 감사 로그 조회만 |
| 평가위원 | 이름 + 전화번호 + SMS OTP | 배정된 회차만 평가 |

### 5.5 디지털 서명 워크플로우

```
평가위원이 "최종 제출" 클릭
  → 평가표 모든 필수 항목 작성 확인
  → 서명 패드 표시 (직접 서명 입력)
  → SMS OTP 발송 → 입력 확인
  → 서버에서:
    1. canonical JSON hash 계산
    2. 평가서 PDF 생성 → hash 계산
    3. signature_artifact 레코드 생성
    4. evaluation_submission 상태를 signed로 변경
    5. audit_event 기록
  → 완료. 이후 수정 불가 (재개방 절차로만 가능)
```

### 5.6 출력 기능

| 출력물 | 내용 | 형식 |
|--------|------|------|
| 평가서 (개별) | 평가위원별 평가내용 + 서명 | PDF |
| 평가 결과표 | 전체 기업 순위 + 점수 | PDF, Excel |
| 평가위원회 결과지 | 최종 순위 + 제외평균 점수 | PDF |
| 감사 로그 | 활동 이력 | Excel |

---

## 6. 사용자가 언급하지 않았지만 추가 제안하는 기능

### 6.1 기피/제외 처리
- 평가위원이 특정 기업과 이해충돌 시 **기피 신청** 기능
- 관리자 승인 후 해당 건 평가에서 제외
- 집계 시 기피 건은 별도 표시

### 6.2 평가 진행 현황 대시보드
- 관리자가 실시간으로 각 위원의 평가 진행 상태 확인
- 미제출 위원 알림 기능

### 6.3 알림 시스템
- 평가 일정 안내 (SMS/이메일)
- 평가 시작/마감 알림
- 미제출 위원 독려 알림

### 6.4 백업 및 복구
- 평가 데이터 정기 백업
- PDF 원본 이중 보관 (DB 메타 + 객체 저장소)
- 감사 로그 체인 검증 도구

### 6.5 접근 로그
- 평가위원의 문서 열람 이력 기록
- 언제, 어떤 문서를, 몇 분간 열람했는지 추적

---



## 7. 프로젝트 폴더 구조 (Next.js 기준)

```
eval/
├── src/
│   ├── app/
│   │   ├── (admin)/              # 관리자 포털
│   │   │   ├── admin/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── sessions/
│   │   │   │   ├── companies/
│   │   │   │   ├── committee/
│   │   │   │   ├── templates/
│   │   │   │   ├── results/
│   │   │   │   ├── exports/
│   │   │   │   └── audit-log/
│   │   │   └── layout.tsx
│   │   ├── (eval)/               # 평가위원 포털
│   │   │   ├── eval/
│   │   │   │   ├── login/
│   │   │   │   ├── sessions/      # 배정 목록
│   │   │   │   └── [sessionId]/
│   │   │   │       └── [applicationId]/  # 평가 수행 화면
│   │   │   └── layout.tsx
│   │   ├── api/
│   │   │   ├── admin/
│   │   │   ├── auth/
│   │   │   ├── eval/
│   │   │   └── export/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── admin/                # 관리자 전용 컴포넌트
│   │   ├── eval/                 # 평가위원 전용 컴포넌트
│   │   │   ├── PdfViewer.tsx     # PDF.js 래핑
│   │   │   ├── EvaluationForm.tsx # Schema-driven 폼
│   │   │   ├── SplitPane.tsx     # 리사이즈 가능 분할 패널
│   │   │   └── SignaturePad.tsx  # 서명 입력
│   │   ├── shared/               # 공통 컴포넌트
│   │   └── ui/                   # 기본 UI 프리미티브
│   ├── lib/
│   │   ├── db/                   # DB 클라이언트, 스키마
│   │   ├── auth/                 # 인증 로직
│   │   ├── storage/              # S3 파일 관리
│   │   ├── pdf/                  # PDF 생성
│   │   ├── evaluation/           # 평가 로직 (집계, 순위)
│   │   ├── template/             # 템플릿 엔진
│   │   ├── import/               # CSV/Excel 파싱
│   │   ├── signature/            # 서명 처리
│   │   └── audit/                # 감사 로그
│   ├── types/                    # TypeScript 타입 정의
│   └── middleware.ts             # 인증/권한 미들웨어
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
├── docker-compose.yml            # Postgres + MinIO(로컬S3)
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 8. 개발 단계 및 마일스톤

### Phase 1: 기반 (1-2주)
- [ ] 프로젝트 초기 설정 (Next.js, PostgreSQL, Prisma)
- [ ] DB 스키마 설계 및 마이그레이션
- [ ] 인증 시스템 (관리자 로그인, 평가위원 OTP 로그인)
- [ ] 파일 저장소 연동 (S3/MinIO)
- [ ] 기본 레이아웃 및 라우팅

### Phase 2: 관리자 기능 (2-3주)
- [ ] 평가 회차 CRUD
- [ ] CSV/Excel 대량 입력
- [ ] 기업 등록 및 순서 관리
- [ ] 사업계획서 PDF 업로드
- [ ] 평가위원 등록 및 배정
- [ ] 평가표 템플릿 관리 (생성, 수정, 버전관리, 공유)

### Phase 3: 평가 수행 (2-3주)
- [ ] 평가위원 포털 (로그인, 목록)
- [ ] 핵심 화면: PDF 뷰어 + 평가폼 분할 화면
- [ ] Schema-driven 평가폼 엔진
- [ ] 초안 자동저장
- [ ] 서명 패드 + OTP 서명 워크플로우
- [ ] 최종 제출 및 불변화

### Phase 4: 집계 및 출력 (1-2주)
- [ ] 점수 집계 로직 (최소최대 제외 평균)
- [ ] 순위 산정
- [ ] 결과 확정 프로세스
- [ ] 평가서/결과표 PDF 출력
- [ ] Excel 내보내기

### Phase 5: 운영 강화 (1-2주)
- [ ] 감사 로그 UI
- [ ] 기피/제외 처리
- [ ] 진행 현황 대시보드
- [ ] 알림 시스템 (SMS/이메일)
- [ ] 접근 이력 추적

### Phase 6: 검증 및 배포 (1주)
- [ ] 통합 테스트
- [ ] 보안 점검
- [ ] 감사 로그 체인 검증
- [ ] 배포 설정

**예상 총 기간: 8-13주 (1인 기준), 팀 구성 시 단축 가능**

---

## 9. 선결정 사항 (구현 전 확인 필요)

| # | 질문 | 영향 | 결정 |
|---|------|------|------|
| 1 | 전자서명이 내부 감사용인가, 법적 효력이 필요한가? | 아키텍처 전체 | **내부 감사용. 법적 효력은 nice-to-have.** HMAC seal 설계로 진행. 향후 PKI/HSM 승격 옵션은 열어둠 |
| 2 | 평가위원 수는 회차별로 가변인가? | 집계 로직 | **가변.** 기본값 5인, 회차 생성 시 지정 가능. 3인 이하 시 min/max 제외 생략 |
| 3 | 동점 처리 규칙은? | 순위 산정 | **3단계: 1순위 가중치 항목별 비교 → 2순위 원점수 합 → 3순위 공동 순위** |
| 4 | SMS OTP는 어떤 서비스 사용? | 인증 | **Coolsms 또는 NHN Cloud.** 인터페이스 추상화로 교체 가능하게 설계 |
| 5 | 파일 저장소는 클라우드(S3)인가 온프레미스(MinIO)인가? | 배포 | **개발은 MinIO, 운영은 환경에 따라.** S3 호환 API로 추상화 |
| 6 | 다중 기관/사업군을 하나의 시스템에서 운영하는가? | 멀티테넌시 | **초기 단일 기관.** 스키마에 tenant_id는 미리 추가하지 않음. 필요 시 마이그레이션 |
| 7 | 관리자 인증에 SSO/기관 계정 연동이 필요한가? | 인증 | **초기 자체 인증.** NextAuth.js 사용, 추후 OIDC/SAML provider 추가 가능 |

---

## 10. 디자인 시스템 & UI 컴포넌트 아키텍처

### 10.1 UI 프레임워크

**shadcn/ui + Tailwind CSS 4 + Radix UI**

shadcn/ui 선택 이유:
- **Copy & paste 방식**: 컴포넌트를 직접 소유하고 수정 가능 → 정부/업무 시스템의 맞춤 요구에 유연하게 대응
- **Radix UI 기반**: 접근성(WCAG) 기본 탑재 → 키보드 네비게이션, 스크린 리더 지원
- **Tailwind CSS**: 일관된 디자인 토큰(theme variables)으로 다크모드, 브랜딩 변경 용이
- **필요한 것만 설치**: 번들 사이즈 최소화

### 10.2 디자인 방향

| 영역 | 결정 | 근거 |
|------|------|------|
| **미적 방향** | Industrial/Utilitarian | 정부/업무 시스템. 기능 우선, 데이터 밀집, 신뢰감 |
| **장식 수준** | Minimal | 타이포그래피와 간격으로 위계 표현. 불필요한 장식 배제 |
| **레이아웃** | Grid-disciplined | 관리자는 사이드바+콘텐츠, 평가위원은 분할 패널. 엄격한 그리드 |
| **색상** | Balanced | 파란색 Primary(신뢰) + semantic colors(상태 표시) |
| **모션** | Minimal-functional | 상태 전환만. 평가 업무에 방해되지 않는 수준 |

### 10.3 타이포그래피

| 역할 | 폰트 | 근거 |
|------|------|------|
| Display/Heading | **Pretendard Variable** | 한글 최적화, 가변폭, 공공기관 톤에 적합 |
| Body/UI | **Pretendard Variable** (동일) | 한국어 가독성 최고수준, 시스템 폰트 대체 불필요 |
| Data/Table | Pretendard (tabular-nums) | 표에서 숫자 정렬 일관성 |
| Code/식별자 | **JetBrains Mono** | 평가ID, 세션코드 등 가독성 |

**타이포그래피 스케일:**
```
text-xs    (12px) — 캡션, 메타정보
text-sm    (14px) — 테이블 셀, 보조 텍스트
text-base  (16px) — 본문
text-lg    (18px) — 섹션 제목
text-xl    (20px) — 페이지 제목
text-2xl   (24px) — 화면 타이틀
text-3xl   (30px) — 대시보드 메인 지표
```

### 10.4 컬러 시스템

```
Primary:     #2563EB (Blue 600)   — 신뢰, 공식성
Primary FG:  #FFFFFF

Semantic:
  Success:   #16A34A (Green 600)  — 제출 완료, 통과
  Warning:   #CA8A04 (Yellow 600) — 마감 임박, 주의
  Error:     #DC2626 (Red 600)    — 오류, 누락
  Info:      #0891B2 (Cyan 600)   — 정보, 안내

Neutral (Warm Gray):
  Background: #FAFAF9 (Stone 50)  — 미색 배경, 눈 피로 감소
  Surface:    #FFFFFF              — 카드, 패널
  Border:     #E7E5E4 (Stone 200)
  Muted:      #78716C (Stone 500) — 보조 텍스트
  Foreground: #1C1917 (Stone 900) — 본문

평가 상태 색상:
  Draft:     Stone 400            — 회색 (준비 중)
  In Progress: Blue 500           — 파랑 (진행 중)
  Completed: Green 500            — 초록 (완료)
  Signed:    Violet 500           — 보라 (서명 완료)
  Finalized: Emerald 600          — 청록 (확정)
```

### 10.5 간격 시스템

```
Base unit: 4px (Tailwind default)
Density: Comfortable (관리자), Compact (평가위원 — 데이터 밀집)

Scale:
  1  (4px)   — 인라인 간격
  2  (8px)   — 텍스트 줄간격
  3  (12px)  — 관련 요소 묶음
  4  (16px)  — 컴포넌트 내부 패딩
  6  (24px)  — 섹션 간격
  8  (32px)  — 카드 간격
  12 (48px)  — 페이지 섹션 구분
  16 (64px)  — 대시보드 섹션 구분

Border Radius:
  sm:  6px   — 버튼, 인풋
  md:  8px   — 카드, 패널
  lg:  12px  — 다이얼로그, 모달
  full: 9999px — 배지, 태그
```

### 10.6 화면별 shadcn/ui 컴포넌트 매핑

#### 관리자 포털

| 화면 | 주요 shadcn 컴포넌트 | 설명 |
|------|---------------------|------|
| **레이아웃** | `Sidebar`, `SidebarProvider`, `Separator` | 고정 사이드바 네비게이션 |
| **대시보드** | `Card`, `Badge`, `Progress` | 회차 현황 카드 + 진행률 바 |
| **회차 관리** | `DataTable` (TanStack Table), `Dialog`, `Select` | 회차 목록 + CRUD 다이얼로그 |
| **기업 입력** | `DataTable`, `Button`, `Input`, `DragDrop` | 엑셀 업로드 + 순서 드래그 |
| **문서 등록** | `Dropzone` (custom), `Dialog`, `ScrollArea` | PDF 드래그앤드롭 업로드 |
| **위원 관리** | `DataTable`, `Avatar`, `Badge`, `Sheet` | 위원 목록 + 배정 사이드패널 |
| **템플릿 편집** | `Accordion`, `Input`, `RadioGroup`, `Switch`, `Slider` | 폼 빌더 인터페이스 |
| **결과 관리** | `DataTable`, `Badge`, `DropdownMenu`, `Dialog` | 순위 테이블 + 확정 다이얼로그 |
| **출력** | `Button`, `DropdownMenu`, `Dialog` | PDF/Excel 다운로드 메뉴 |
| **감사 로그** | `DataTable`, `Badge`, `Collapsible` | 필터링 가능한 로그 테이블 |
| **Import** | `DataTable`, `Alert`, `Progress` | 업로드 진행 + 오류 목록 |
| **공통** | `Form`, `Tooltip`, `Toast`, `AlertDialog` | 폼 검증, 확인 다이얼로그, 알림 |

#### 평가위원 포털

| 화면 | 주요 shadcn 컴포넌트 | 설명 |
|------|---------------------|------|
| **로그인** | `Card`, `Input`, `Button`, `Form` | 이름+전화번호+OTP 입력 |
| **평가 목록** | `Card`, `Badge`, `Progress` | 배정 회차 카드 목록 |
| **평가 수행** | `ResizablePanelGroup`, `ScrollArea`, `Accordion` | 분할 화면 (핵심) |
| PDF 뷰어 | `ScrollArea`, custom `PdfViewer` (react-pdf) | 문서 열람 |
| 평가 폼 | `RadioGroup`, `Textarea`, `Accordion`, `Badge` | 동적 평가 폼 |
| 서명 | custom `SignaturePad`, `Dialog`, `Input` (OTP) | 서명 + OTP 모달 |
| **이력** | `DataTable`, `Badge` | 평가 완료 이력 |
| **공통** | `Toast`, `AlertDialog`, `Skeleton` | 알림, 확인, 로딩 |

### 10.7 핵심 UI 패턴 상세

#### A. Split Pane (평가 수행 화면 — 시스템의 핵심)

```tsx
import { ResizableHandle, ResizablePanel, ResizablePanelGroup }
  from "@/components/ui/resizable"
import { PdfViewer } from "@/components/eval/PdfViewer"
import { EvaluationForm } from "@/components/eval/EvaluationForm"
import { EvaluationHeader } from "@/components/eval/EvaluationHeader"

// 평가 수행 화면 구조
export function EvaluationView({ session, application, formSchema }) {
  return (
    <div className="flex flex-col h-screen">
      {/* 상단 헤더: 기업명, 진행상황, 비율조절 토글 */}
      <EvaluationHeader
        companyName={application.company.name}
        progress={`${currentIndex}/${totalApplications}`}
      />

      {/* 메인 분할 화면 */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* 좌측: PDF 문서 뷰어 (70%) */}
        <ResizablePanel defaultSize={70} minSize={40}>
          <PdfViewer
            url={application.documents[0].url}
            fileName={application.documents[0].originalFilename}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 우측: 평가 폼 (30%) */}
        <ResizablePanel defaultSize={30} minSize={25}>
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <EvaluationForm
                schema={formSchema}
                draft={draft}
                onSave={handleAutoSave}
                onSubmit={handleFinalSubmit}
              />
            </div>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
```

#### B. PDF Viewer (react-pdf 기반)

```tsx
import { useState, useCallback } from "react"
import { Document, Page } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react"

export function PdfViewer({ url, fileName }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.2)

  return (
    <div className="flex flex-col h-full">
      {/* PDF 툴바 */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-stone-50">
        <span className="text-sm text-stone-600 truncate">{fileName}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon"
            onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-stone-500 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="ghost" size="icon"
            onClick={() => setScale(s => Math.min(2.5, s + 0.2))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF 본문 (연속 스크롤) */}
      <ScrollArea className="flex-1 bg-stone-100">
        <div className="flex flex-col items-center p-4 gap-2">
          <Document
            file={url}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<Skeleton className="w-[595px] h-[842px]" />}
          >
            {Array.from({ length: numPages }, (_, i) => (
              <Page
                key={i}
                pageNumber={i + 1}
                scale={scale}
                className="shadow-md"
              />
            ))}
          </Document>
        </div>
      </ScrollArea>
    </div>
  )
}
```

#### C. Schema-driven 평가 폼 엔진

```tsx
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger }
  from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

export function EvaluationForm({ schema, draft, onSave, onSubmit }) {
  const totalItems = schema.sections.flatMap(s => s.items).length
  const filledItems = countFilledItems(draft?.answers)
  const progressPct = Math.round((filledItems / totalItems) * 100)

  return (
    <div className="space-y-4">
      {/* 진행률 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">평가 진행률</span>
          <Badge variant={progressPct === 100 ? "default" : "secondary"}>
            {filledItems}/{totalItems}
          </Badge>
        </div>
        <Progress value={progressPct} className="h-2" />
      </div>

      {/* 섹션별 평가 항목 */}
      <Accordion type="multiple" defaultValue={schema.sections.map(s => s.id)}>
        {schema.sections.map(section => (
          <AccordionItem key={section.id} value={section.id}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <span className="font-medium">{section.title}</span>
                <Badge variant="outline" className="text-xs">
                  {section.weight}점
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              {section.items.map(item => renderItem(item, draft))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* 액션 버튼 */}
      <div className="flex gap-2 pt-4 border-t sticky bottom-0 bg-background">
        <Button variant="outline" className="flex-1"
          onClick={onSave} disabled={isSaving}>
          {isSaving ? "저장 중..." : "초안 저장"}
        </Button>
        <Button className="flex-1"
          onClick={onSubmit} disabled={progressPct < 100}>
          최종 제출
        </Button>
      </div>
    </div>
  )
}

function renderItem(item, draft) {
  switch (item.type) {
    case "radio_score":
      return (
        <div key={item.id} className="space-y-2">
          <Label className="text-sm">
            {item.label}
            {item.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <RadioGroup
            value={draft?.answers?.[item.id] ?? ""}
            className="flex flex-wrap gap-2"
          >
            {item.options.map(opt => (
              <div key={opt.score} className="flex items-center space-x-1">
                <RadioGroupItem
                  value={String(opt.score)}
                  id={`${item.id}_${opt.score}`}
                />
                <Label htmlFor={`${item.id}_${opt.score}`}
                  className="text-xs cursor-pointer">
                  {opt.score}점 ({opt.label})
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      )
    case "text":
      return (
        <div key={item.id} className="space-y-1">
          <Label className="text-sm">{item.label}</Label>
          <Textarea
            value={draft?.answers?.[item.id] ?? ""}
            placeholder="평가 의견을 입력하세요"
            rows={3}
          />
        </div>
      )
  }
}
```

#### D. DataTable (기업/회차/결과 관리)

```tsx
"use client"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/DataTable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger }
  from "@/components/ui/dropdown-menu"
import { ArrowUpDown, MoreHorizontal, Eye, Edit, Trash2 } from "lucide-react"

const columns: ColumnDef<Application>[] = [
  {
    accessorKey: "evaluationOrder",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting()}>
        순서 <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.getValue("evaluationOrder")}</span>
    ),
  },
  {
    accessorKey: "company.name",
    header: "기업명",
    cell: ({ row }) => <span className="font-medium">{row.getValue("company")?.name}</span>,
  },
  {
    accessorKey: "status",
    header: "상태",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      const variant = {
        registered: "secondary",
        evaluating: "default",
        completed: "success",
        excluded: "destructive",
      }[status]
      const label = {
        registered: "등록",
        evaluating: "평가중",
        completed: "완료",
        excluded: "제외",
      }[status]
      return <Badge variant={variant}>{label}</Badge>
    },
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem><Eye className="mr-2 h-4 w-4" /> 상세보기</DropdownMenuItem>
          <DropdownMenuItem><Edit className="mr-2 h-4 w-4" /> 수정</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> 삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]
```

#### E. 서명 패드 (최종 제출)

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription }
  from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SignaturePad } from "@/components/eval/SignaturePad"

export function SignatureDialog({ open, onOpenChange, onSubmit }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>최종 제출 — 서명</DialogTitle>
          <DialogDescription>
            아래에 서명 후 휴대전화로 전송된 인증번호를 입력하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 서명 캔버스 */}
          <div className="border rounded-lg bg-white">
            <SignaturePad
              onChange={setSignatureData}
              className="w-full h-32"
            />
          </div>

          {/* OTP 입력 */}
          <div className="space-y-2">
            <Label>인증번호 (SMS)</Label>
            <div className="flex gap-2">
              <Input placeholder="6자리 인증번호" maxLength={6} />
              <Button variant="outline" onClick={sendOtp}>전송</Button>
            </div>
          </div>

          <Button className="w-full" onClick={handleSubmit}>
            서명하고 제출
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### 10.8 피해야 할 UI 패턴 (AI Slop 방지)

| 피해야 할 패턴 | 대신 사용 |
|----------------|----------|
| 보라색/인디고 그라데이션 배경 | 단색 Blue 600 배경 |
| 3열 카드 그리드 (아이콘+제목+설명) | 데이터 테이블 또는 목록 뷰 |
| 중앙 정렬된 모든 것 | 왼쪽 정렬 기본, 데이터는 컬럼 정렬 |
| 둥근 border-radius 통일 | 위계에 따른 차등 (sm/md/lg) |
| 장식용 블롭/원형 SVG | 충분한 여백과 타이포그래피 위계 |
| "Welcome to" / "Unlock" 마케팅 카피 | 기능 중심 헤딩 ("평가 회차 관리", "제출 현황") |
| 카드 남용 | 테이블/리스트가 더 적합하면 테이블 사용 |
| Hero 섹션 | 즉각적인 기능 접근 (관리자 대시보드 바로 표시) |

### 10.9 접근성 요구사항

| 항목 | 요구사항 |
|------|----------|
| 키보드 네비게이션 | 모든 인터랙티브 요소 Tab 접근, 포커스 표시 |
| 스크린 리더 | ARIA 속성, 라벨 연결, 상태 알림 |
| 색상 대비 | WCAG AA 이상 (4.5:1 본문, 3:1 대형 텍스트) |
| 터치 대상 | 최소 44x44px |
| 포커스 트랩 | 모달 다이얼로그 내 포커스 순환 |
| 에러 알림 | 인라인 에러 메시지 + aria-invalid |

### 10.10 화면별 Information Architecture 명세

#### 관리자 포털 IA

| 화면 | First Focus | Primary Action | Default Sort | Entry | Exit |
|------|------------|----------------|-------------|-------|------|
| **대시보드** | 최근 회차 카드 | 회차 상세 이동 | status(진행중→예정→완료) | 사이드바 "대시보드" | 회차 상세 |
| **회차 관리** | 검색 인풋 | "새 회차" 버튼 | created_at desc | 사이드바 "회차 관리" | 회차 상세/편집 |
| **회차 상세** | 첫 탭(기본정보) | 상태 변경 드롭다운 | — | 회차 목록에서 클릭 | 뒤로가기 |
| **기업 입력** | 업로드 버튼 | CSV/Excel 업로드 | evaluation_order asc | 회차 상세 > 기업 탭 | — |
| **문서 등록** | Dropzone | PDF 업로드 | uploaded_at desc | 기업 행에서 "문서" 액션 | — |
| **위원 관리** | 검색 인풋 | "위원 추가" 버튼 | name asc | 사이드바 "위원 관리" | — |
| **템플릿 편집** | 첫 섹션 인풋 | "저장" 버튼 | — | 템플릿 목록에서 편집 | 템플릿 목록 |
| **결과 관리** | 최종 순위 테이블 | "결과 확정" 버튼 | rank asc | 회차 상세 > 결과 탭 | — |
| **감사 로그** | 날짜 범위 피커 | 필터 적용 | occurred_at desc | 사이드바 "감사 로그" | — |

#### 평가위원 포털 IA

| 화면 | First Focus | Primary Action | Default Sort | Entry | Exit |
|------|------------|----------------|-------------|-------|------|
| **로그인** | 이름 인풋 | "인증번호 전송" | — | URL 직접 접근 | 평가 목록 |
| **평가 목록** | 첫 미완료 회차 카드 | 회차 진입 | status(진행중→미시작→완료) | 로그인 성공 | 평가 수행 화면 |
| **평가 수행** | PDF 첫 페이지 | "초안 저장" / "최종 제출" | evaluation_order | 회차에서 기업 선택 | 평가 목록 |
| **이력** | 첫 완료 건 | 상세 보기 | submitted_at desc | 사이드바 "이력" | — |

### 10.11 Interaction State Coverage Matrix

모든 주요 화면은 다음 5가지 상태를 반드시 구현:

| 상태 | 정의 | 관리자 대시보드 예시 | 평가 수행 화면 예시 |
|------|------|---------------------|-------------------|
| **Loading** | 데이터 페치 중 | Skeleton 카드 3개 | PDF Skeleton + 폼 Skeleton |
| **Empty** | 데이터 없음 | "등록된 평가 회차가 없습니다" + "새 회차 만들기" CTA | "배정된 평가가 없습니다" |
| **Error** | 페치/액션 실패 | Alert 배너 + 재시도 버튼 | Error boundary + "다시 시도" |
| **Success** | 정상 완료 | 데이터 표시 | PDF + 폼 정상 표시 |
| **Partial** | 일부 데이터만 | 진행중 회차만 있고 완료 건 없음 | 일부 항목만 작성된 초안 |

#### 불가역 액션 UX 명세

| 액션 | 확인 단계 | 되돌리기 | UI 패턴 |
|------|----------|---------|---------|
| **회차 Open** | AlertDialog: "평가를 시작하시겠습니까? 시작 후 기본 정보 변경이 제한됩니다." | 관리자 권한으로 재개방 (사유 필수) | `AlertDialog` with destructive variant |
| **결과 확정** | AlertDialog: "결과를 확정하시겠습니까? 확정 후 순위 변경이 불가합니다." | 불가 (audit log에 기록) | `AlertDialog` + 확인 체크박스 "확정 사실을 이해합니다" |
| **최종 제출** | 서명 패드 + OTP → AlertDialog: "제출 후 수정할 수 없습니다." | 관리자 재개방 (기존 제출 is_valid=false) | 서명 Dialog → 최종 확인 Dialog |
| **재개방** | AlertDialog: "이 평가를 재개방하시겠습니까? 기존 제출이 무효 처리됩니다." 사유 입력 필수 | N/A (이미 되돌린 것) | `AlertDialog` + Textarea(사유) + 선택: 전체 재개방/개별 재개방 |

### 10.12 핵심 사용자 여정 스토리보드

#### 여정 A: 관리자 — 평가 회차 생성부터 결과 확정까지

```
1. [대시보드] "새 회차 만들기" 클릭
   → 회차 생성 Dialog 오픈 (제목, 설명, 위원수 기본값 5)
   
2. [회차 상세 > 기본정보] 회차 정보 입력, 상태=draft
   → 템플릿 선택 (공유 템플릿 목록에서 선택 또는 새로 생성)
   → 선택 시 session_form_definition으로 스냅샷 고정
   
3. [회차 상세 > 기업 탭] CSV/Excel 업로드
   → 미리보기 → 검증 → 일괄 저장
   → 순서 드래그앤드롭으로 조정
   → 개별 기업에 사업계획서 PDF 등록
   
4. [회차 상세 > 위원 탭] 평가위원 배정
   → 등록된 위원 목록에서 체크박스 선택
   → 위원장 지정 (1명)
   
5. [회차 상세 > 기본정보] "평가 시작" 버튼
   → AlertDialog 확인 → status: open
   → 배정된 위원에게 SMS 알림 발송
   
6. [대시보드] 진행 현황 모니터링
   → 위원별 제출 상태 실시간 확인
   → 미제출 위원 독려 알림
   
7. [회차 상세 > 결과 탭] 모든 위원 제출 완료 후
   → "집계 실행" → 최소최대 제외 평균 자동 계산
   → 순위 확인 → "결과 확정" → AlertDialog (체크박스 확인)
   → status: finalized
```

#### 여정 B: 평가위원 — 첫 로그인부터 최종 제출까지

```
1. [로그인] SMS로 수신한 링크 접속 (또는 직접 URL)
   → 이름 + 전화번호 입력 → OTP 발송 → 인증
   → 자동으로 평가 목록으로 이동
   
2. [평가 목록] 배정받은 회차 카드 확인
   → "진행 중" 배지 표시
   → 회차 카드 클릭 → 기업 목록 진입
   
3. [평가 수행] 첫 번째 기업 선택
   → 좌측 70%: 사업계획서 PDF 로딩 (Skeleton → 렌더링)
   → 우측 30%: 평가 폼 (Accordion + RadioGroup)
   → 항목 작성 → 자동저장 (30초 간격, optimistic locking)
   
4. [평가 수행] 모든 필수 항목 작성 완료
   → "최종 제출" 버튼 활성화
   → 클릭 → 서명 Dialog:
     a. 서명 패드에 서명 입력
     b. "인증번호 전송" → SMS OTP
     c. 인증번호 입력 → "서명하고 제출"
   → 서버에서 PDF 생성 + hash + HMAC seal 저장
   → 다음 기업으로 자동 이동
   
5. [평가 목록] 모든 기업 평가 완료
   → 회차 카드에 "완료" 배지
   → 이력 탭에서 제출 내역 확인 가능
```

### 10.13 반응형 규칙

| Breakpoint | 관리자 포털 | 평가위원 포털 |
|-----------|-----------|-------------|
| **< 768px** (mobile) | 미지원 (관리자는 태블릿/데스크톱 필수) | 미지원 |
| **768-1024px** (태블릿) | 사이드바 축소(아이콘만), 카드 1열 | 세로 스택 (PDF 위, 폼 아래), 비율 조정 비활성 |
| **1024-1440px** (데스크톱) | 사이드바 확장, 기본 레이아웃 | 분할 패널 70:30 (기본값) |
| **> 1440px** (와이드) | 콘텐츠 max-width 1280px 중앙 정렬 | 분할 패널 70:30, PDF 여백 증가 |

### 10.14 인쇄 규칙

| 출력물 | 페이지 사이즈 | 페이지 브레이크 | 서명 블록 | 헤더/푸터 |
|--------|-------------|---------------|----------|----------|
| **평가서 (개별)** | A4 | 섹션별 강제 브레이크 | 마지막 페이지 하단 고정 | "평가위원회 평가서 — 기밀" |
| **결과표** | A4 | 15개 기업 단위 | 없음 | "평가 결과 종합표" + 페이지 번호 |
| **결과지 (위원회용)** | A4 | 단일 페이지 | 위원장 서명 블록 | "최종 확정본" 워터마크 |

```css
/* 인쇄 전용 스타일 기본 구조 */
@media print {
  body { font-size: 11pt; color: #000; }
  
  .no-print { display: none !important; }
  
  .page-break-before { page-break-before: always; }
  .page-break-after { page-break-after: always; }
  
  /* 서명 블록: 마지막 페이지 하단에 고정 */
  .signature-block {
    position: fixed;
    bottom: 2cm;
    left: 0;
    width: 100%;
    page-break-inside: avoid;
  }
}
```

---

## 11. 업데이트된 기술 스택

```
Next.js 15 (App Router) + TypeScript     ← 단일 웹앱
shadcn/ui + Tailwind CSS 4 + Radix UI    ← UI 컴포넌트 + 스타일링
TanStack Table v8                         ← 데이터 테이블
react-pdf (PDF.js 래핑)                   ← PDF 뷰어
react-resizable-panels                    ← 분할 패널
react-hook-form + zod                     ← 폼 검증
Prisma                                    ← ORM + 마이그레이션
PostgreSQL 16                             ← RDB + JSONB
S3-compatible Object Storage              ← PDF/파일 저장
Puppeteer                                 ← 서버 PDF 생성
@tanstack/react-table                     ← DataTable
lucide-react                              ← 아이콘
```

---

## 12. 보안 설계

### 12.1 인증 보안

| 항목 | 정책 | 값 |
|------|------|-----|
| **관리자 세션 TTL** | 절대 만료 | 8시간 (비활성 30분 시 만료) |
| **평가위원 세션 TTL** | OTP 인증 후 세션 발급 | 4시간 (비활성 1시간 시 만료) |
| **OTP 유효시간** | SMS OTP | 3분 |
| **OTP Rate Limit** | 동일 전화번호 | 5회/10분 (초과 시 30분 잠금) |
| **로그인 Rate Limit** | 관리자 이메일 | 10회/15분 (초과 시 1시간 잠금) |
| **비밀번호** | 최소 12자, 대소문자+숫자+특수문자 | bcrypt(rounds=12) |

### 12.2 권한 및 접근 제어

```
관리자 (admin):     전체 접근
운영자 (operator):  회차 운영, 출력 (설정/위원관리 불가)
감사 (auditor):     감사 로그 읽기 전용
평가위원:          배정된 회차의 기업만 접근
                    - API 레벨: session_committee_assignment 조인으로 검증
                    - 미들웨어: /api/eval/* 요청 시 세션+배정 검증
```

### 12.3 파일 보안

| 항목 | 정책 |
|------|------|
| **PDF 접근** | S3 presigned URL (5분 만료, 1회용 아님) |
| **업로드** | 파일 타입 검증 (magic bytes), 최대 50MB |
| **다운로드 로그** | 모든 파일 접근을 audit_event에 기록 |
| **무결성** | SHA256 hash를 DB에 저장, 조회 시 검증 |

### 12.4 데이터 보호

- 평가 제출물은 불변(immutable) — UPDATE/DELETE 금지, 무효화만 가능
- 감사 로그는 hash chain으로 변조 탐지
- CSRF 토큰 (SameSite=Strict 쿠키)
- Content-Security-Policy 헤더 설정
- 입력값 sanitization (XSS 방지)

---

## 13. 운영 설계

### 13.1 데이터베이스 인덱스 및 제약조건

```sql
-- 필수 인덱스
CREATE INDEX idx_application_session ON application(session_id, status);
CREATE INDEX idx_submission_application ON evaluation_submission(application_id, is_valid);
CREATE INDEX idx_submission_committee ON evaluation_submission(committee_member_id, session_id);
CREATE INDEX idx_draft_committee_app ON evaluation_draft(committee_member_id, application_id);
CREATE INDEX idx_audit_session_time ON audit_event(session_id, occurred_at DESC);
CREATE INDEX idx_audit_actor ON audit_event(actor_type, actor_id, occurred_at DESC);
CREATE INDEX idx_result_session ON result_snapshot(session_id, rank);

-- 필수 제약조건
ALTER TABLE evaluation_submission
  ADD CONSTRAINT chk_submission_state_valid
  CHECK (
    (submission_state = 'signed' AND is_valid = true)
    OR (submission_state != 'signed')
  );

ALTER TABLE evaluation_submission
  ADD CONSTRAINT chk_invalidated_reason
  CHECK (
    (submission_state = 'invalidated' AND invalidated_reason IS NOT NULL)
    OR (submission_state != 'invalidated')
  );

ALTER TABLE session_form_definition
  ADD CONSTRAINT uq_session_form UNIQUE (session_id);

-- 중복 제출 방지
ALTER TABLE evaluation_submission
  ADD CONSTRAINT uq_submission_committee_app
  UNIQUE (application_id, committee_member_id)
  WHERE is_valid = true;
```

### 13.2 모니터링

| 영역 | 메트릭 | 임계값 |
|------|--------|--------|
| **애플리케이션** | 응답 시간 p95 | < 2초 |
| **애플리케이션** | 에러율 | < 0.5% |
| **DB** | 커넥션 풀 사용률 | < 80% |
| **DB** | 쿼리 응답 시간 p95 | < 500ms |
| **파일** | 업로드 실패율 | < 1% |
| **평가** | 자동저장 충돌율 | < 0.1% |
| **인증** | OTP 발송 성공률 | > 99% |

### 13.3 백업 및 복구

| 대상 | 방식 | 주기 | 보관 |
|------|------|------|------|
| **PostgreSQL** | pg_basebackup + WAL archiving | 실시간 | 30일 |
| **S3 (PDF/파일)** | 버전 관리 활성화 + cross-region 복제 | 실시간 | 무기한 |
| **감사 로그** | DB 백업에 포함 + 별도 CSV 아카이브 | 일별 | 5년 |

### 13.4 장애 복구 시나리오

| 시나리오 | 영향 | 복구 절차 | RTO |
|----------|------|----------|-----|
| **DB 장애** | 전체 서비스 불가 | Standby 승격 → 앱 재시작 | 5분 |
| **S3 장애** | PDF 열람/업로드 불가 | 서비스 계속 (PDF 제외), S3 복구 후 자동 복원 | 15분 |
| **OTP 서비스 장애** | 평가위원 로그인 불가 | 임시 코드 발급 (관리자 화면에서 수동 생성) | 즉시 |
| **PDF 생성 장애** | 출력 불가 (평가는 계속) | 큐에 적재, worker 재시작 후 자동 재시도 | 10분 |
| **평가 중 autosave 충돌** | 마지막 저장분 손실 가능 | version 기반 optimistic lock → 사용자에게 충돌 알림, 수동 병합 | 즉시 |

### 13.5 마이그레이션 전략

- Prisma Migrate로 스키마 버전 관리
- 배포 전 마이그레이션 실행 (CI/CD 파이프라인에 통합)
- destructive change는 2단계 마이그레이션 (추가 → 데이터 이관 → 삭제)
- rollback 스크립트를 모든 마이그레이션에 포함

---

## 14. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 전자서명 법적 수준 오판 | 설계 재작업 | 사전 요구사항 확정 |
| 평가 시작 후 템플릿 변경 | 감사 무결성 훼손 | session_form_definition 스냅샷 고정으로 원천 차단 |
| 대용량 PDF 브라우저 메모리 | 평가 화면 지장/크래시 | react-pdf lazy loading, 페이지 단위 렌더, 크기 제한(50MB) |
| 동시 다수 평가 시 DB 부하 | 응답 지연 | 낙관적 락, 초안 자동저장 간격 조절 (30초) |
| OTP/SMS 장애 | 평가위원 로그인 불가 | 대체 인증 수단 준비 (임시 코드, 관리자 수동 발급) |
| autosave↔submit 경합 | 데이터 불일치 | optimistic locking (version 컬럼), 서버 side 최종 승자 |
| 평가위원 인증 강도 부족 | 부정 평가 위험 | 이름+전화+OTP 기본, IP/기기 지문 추가, 향후 공인인증서 승격 옵션 |

---

## GSTACK REVIEW REPORT

| Review | Runs | Score | Status | Key Findings |
|--------|------|-------|--------|-------------|
| Design Review | 1 | **5/10 → 8.5/10** (projected) | Completed & Applied | IA 명세 누락, State Matrix 전무, 사용자 여정 미정의, 불가역 UX 미정의 → 섹션 10.10-10.14에 반영 완료 |
| Eng Review | 1 | **6.5/10** | Completed & Applied | session_form_definition 누락, submission_state 없음, 집계 추적성 부족, 보안/운영 미흡 → 섹션 3, 5.3, 13, 14에 반영 완료 |
| CEO Review | 0 | — | Not Run | — |
| Codex Review | 0 | — | Not Run | — |

### Design Review 상세

| Dimension | Score | Issue | Resolution |
|-----------|-------|-------|------------|
| Information Architecture | 4/10 | 화면별 IA 명세 전무 | 섹션 10.10 추가 |
| Interaction State Coverage | 2/10 | Loading/Empty/Error/Success/Partial 미정의 | 섹션 10.11 추가 |
| User Journey | 3/10 | 스토리보드 없음 | 섹션 10.12 추가 |
| AI Slop Risk | 7/10 | 양호 | 섹션 10.8 유지 |
| Responsive/Accessibility | 4/10 | Breakpoint별 규칙 부족 | 섹션 10.13 추가 |
| Unresolved Decisions | 3/10 | 불가역 액션 UX 미정의 | 섹션 10.11 표에 반영 |

### Eng Review 상세

| Category | Severity | Issue | Resolution |
|----------|----------|-------|------------|
| DB Schema | Critical | session_form_definition 테이블 누락 | 섹션 3.2에 명시적 추가 |
| DB Schema | High | evaluation_submission에 status 컬럼 없음 | submission_state enum 추가 |
| Data Integrity | High | autosave↔submit 경합 조건 | optimistic locking 명시, 리스크에 추가 |
| Aggregation | High | result_snapshot 집계 run 추적성 부족 | aggregation_run 테이블 + 섹션 5.3 보강 |
| Aggregation | High | 점수 집계 규칙 미정의 | 집계 정책 테이블 추가 (최소 제출 수, 동점, 반올림) |
| Security | High | 세션/Rate Limit 정책 없음 | 섹션 13에 구체적 수치 추가 |
| Operations | Medium | 모니터링/백업 미흡 | 섹션 14에 추가 |
| Operations | Medium | 장애 복구 시나리오 없음 | 섹션 14.4에 추가 |
| Operations | Medium | 필수 Index/Constraint 누락 | 섹션 14.1에 추가 |

**VERDICT:** Design + Eng Review 완료. 결과 PLAN.md에 반영됨. 선결정 사항(섹션 9)에 대한 사용자 확인 필요.
