# Platform Unification Design

Date: 2026-04-23

## Goal

Unify `eval-system` and `biz-support-hub` into one service from the user's perspective: one URL, one login, one navigation shell, and one deployment path. The first implementation must preserve the working behavior of both systems while reducing the operational burden of running them separately.

## Current Systems

### eval-system

- Next.js 16 App Router application.
- Owns the evaluation workflow: admin evaluation management, evaluator OTP login, scoring, signature, aggregation, finalized result export, integration API, and webhook delivery.
- Uses Prisma 7, PostgreSQL, Redis, and S3-compatible storage.
- Already has integration smoke tooling and OpenAPI validation.

### biz-support-hub

- FastAPI backend plus Vite React frontend.
- Owns business support operations: participants, programs, support cases, attachments, imports, evaluation result sync, user accounts, and role policy.
- Uses SQLAlchemy, Alembic, PostgreSQL-compatible DB mode, JWT bearer auth, and Google Drive for attachments when configured.
- Backend and frontend have separate test/build commands.

## Recommended Architecture

Use `eval-system`'s Next.js app as the unified web shell, login entry point, and public-facing service. Keep `biz-support-hub`'s FastAPI backend as an internal business API module during the first integration phase.

Target repository shape:

```text
platform/
  apps/
    web/                 # Next.js unified shell, eval UI, shared navigation
    biz-api/             # FastAPI business API, migrated from biz-support-hub/backend
  packages/
    integration-contracts/
      openapi/
      webhook-payloads/
      shared-field-mapping.md
  infra/
    docker-compose.yml
    proxy/
  docs/
    integration/
    operations/
```

The initial migration may use the current `eval-system` repository as the new platform repository to preserve its remote history, then import `biz-support-hub` under `apps/biz-api` and selectively migrate the Vite frontend pages into the Next.js shell.

## User Experience

- Users visit one service URL.
- Business operators and admins log in through one login screen.
- The shell navigation includes business operations and evaluation operations:
  - Dashboard
  - Programs
  - Participants
  - Support Cases
  - Attachments
  - Evaluation Management
  - Evaluation Results
  - Integration Webhooks
  - Users
- Evaluator OTP login can remain a separate `/eval/login` flow because evaluator identity and SMS verification are a distinct trust path.

## Authentication Design

The unified shell should use one admin/operator login system. Prefer making the Next.js app the session authority because it already controls the final user-facing shell and evaluation admin pages.

Phase 1:

- Keep FastAPI's bearer-token enforcement.
- Add a server-to-server or proxy-issued token path from Next.js to FastAPI.
- Preserve FastAPI role checks for `ADMIN` and `OPERATOR`.
- Do not expose FastAPI auth/login UI as the primary user entry point.

Phase 2:

- Align admin/operator user accounts into one source of truth.
- Either:
  - move business user accounts into the Next.js/Prisma auth store, or
  - let Next.js validate sessions against FastAPI's user account model through a stable internal auth endpoint.
- Choose the direction after comparing current user fields and password hashing policies.

Evaluator OTP remains separate unless a future policy requires admins/operators and evaluators to share identity records.

## API And Routing

External routing:

```text
/                         -> Next.js shell
/admin/*                  -> evaluation/admin pages during transition
/biz/*                    -> business pages migrated into Next.js
/eval/*                   -> evaluator pages
/api/eval/*               -> Next.js evaluation APIs
/api/v1/integration/*     -> Next.js integration APIs
/api/biz/*                -> reverse proxy to FastAPI /api/v1/*
```

Keep FastAPI behind the platform boundary. The browser should call the Next.js origin; routing or proxying decides whether the request lands in Next.js route handlers or FastAPI.

## Data Strategy

Do not merge databases first. Initial DB consolidation should be operational, not logical:

- Run both domains in the same deployment stack.
- Prefer the same PostgreSQL instance with separate logical boundaries:
  - current eval tables remain as-is
  - business tables remain as-is
- Avoid renaming or merging `company`, `participant`, `application`, and `support_case` models until the UI and auth integration are stable.

After the platform shell is stable, define the canonical relationships:

- `program` maps to an evaluation session source.
- `support_case` maps to an external application or selected result target.
- `attachment` maps to business documents, while evaluation PDFs remain immutable evaluation artifacts.

## Frontend Migration

Do not keep two user-facing React apps long term. The Vite frontend should be retired after its pages are migrated into the Next.js shell.

Recommended order:

1. Port API client types and resource wrappers.
2. Port low-risk list/detail pages:
   - Programs
   - Participants
   - Support Cases
3. Port attachment upload page after Drive credentials and upload QA are stable.
4. Port user management page after auth source-of-truth is chosen.
5. Remove Vite frontend from the deployed service.

The visual system should converge on the existing Next.js/shadcn-style shell rather than preserving the Vite UI as a separate style.

## Deployment Design

First unified deployment should still run multiple processes:

- `web`: Next.js app
- `biz-api`: FastAPI app
- `postgres`: shared or attached PostgreSQL
- `redis`: eval auth/OTP/rate-limit support
- `minio` or production S3-compatible storage
- optional reverse proxy if the hosting platform does not provide path routing

The deployment contract is one domain and one release command, not necessarily one OS process.

## Testing Strategy

Root-level verification should orchestrate both projects:

- Next.js lint/build.
- eval Playwright integration suite.
- FastAPI pytest suite.
- biz frontend build until Vite is retired.
- OpenAPI/integration contract checks.
- Smoke test through the unified URL:
  - login
  - business page load
  - eval admin page load
  - integration API health
  - webhook sample delivery path

## Migration Phases

### Phase 0: Preserve Current State

- Ensure both repositories are clean and pushed.
- Record current commit hashes.
- Decide whether the final repository starts from `eval-system` or a new `platform` repository.

Recommendation: start from `eval-system` because it already has the production-facing integration API and was just pushed.

### Phase 1: Monorepo Skeleton

- Move current Next.js app into `apps/web` or keep it at root temporarily with clear migration notes.
- Import `biz-support-hub/backend` into `apps/biz-api`.
- Add root scripts/docs for running both.
- Add unified env template.
- Add no behavior changes.

### Phase 2: Unified Deployment

- Add root docker compose for `web`, `biz-api`, and shared infra.
- Add path routing for `/api/biz/*`.
- Verify both health checks from one host.

### Phase 3: Unified Login Boundary

- Make Next.js the public login shell for admin/operator users.
- Add token/session forwarding to FastAPI.
- Preserve FastAPI as authorization enforcement for business APIs.

### Phase 4: Business UI Port

- Migrate Vite pages into the Next.js shell one domain at a time.
- Keep FastAPI API contracts stable while UI moves.
- Retire Vite once pages are migrated and verified.

### Phase 5: Domain Model Consolidation

- Only after UI/auth/deploy are stable, decide whether to merge overlapping business/evaluation tables.
- Create migration plans per entity with rollback and report checks.

## Risks And Guardrails

- Big-bang rewrite risk: avoid moving runtime, UI, auth, and DB at once.
- Auth confusion risk: keep evaluator OTP and admin/operator login explicitly separate until policy says otherwise.
- DB merge risk: postpone canonical entity merge until after a single shell is running.
- Deployment risk: one domain can still route to multiple internal services.
- Concurrent work risk: freeze feature work or branch both repos before moving files.

## Success Criteria

- A user reaches business and evaluation admin pages from one URL and one admin/operator login.
- Existing eval integration tests still pass.
- Existing FastAPI backend tests still pass.
- The business Vite frontend is either retired or explicitly marked transitional.
- Deployment can be executed from one root command or one deployment pipeline.
- HANDOVER/README documents the new structure and commands.
