# Platform Phase 0-2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `eval-system` and `biz-support-hub` into one platform repository with a unified repo layout, shared root tooling, and one deployable stack boundary without changing user-visible business or evaluation behavior yet.

**Architecture:** Keep the existing Next.js app as the public shell and import the FastAPI backend as an internal business API module. Phase 0-2 stops before unified auth and before UI porting; it focuses on repository structure, root scripts, shared environment conventions, and one deployment stack that can host both services under a single domain.

**Tech Stack:** Next.js 16, TypeScript, Prisma 7, Playwright, FastAPI, SQLAlchemy, Alembic, Python 3.13, PostgreSQL, Redis, S3-compatible storage, Docker Compose, reverse proxy routing

---

## File Structure Lock-In

Target structure for this phase:

- Create: `apps/biz-api/`
- Create: `apps/biz-api/app/`
- Create: `apps/biz-api/alembic/`
- Create: `apps/biz-api/scripts/`
- Create: `apps/biz-api/requirements.txt`
- Create: `apps/biz-api/alembic.ini`
- Create: `apps/biz-api/README.md`
- Keep (temporarily): current Next.js app at repository root
- Create: `infra/docker-compose.platform.yml`
- Create: `infra/proxy/platform.nginx.conf`
- Create: `scripts/platform-dev.ps1`
- Create: `scripts/platform-test.ps1`
- Create: `.env.platform.example`
- Modify: `README.md`
- Modify: `HANDOVER.md`

Reasoning:

- Keeping the Next.js app at root in the first cut minimizes file churn in the currently working production-facing app.
- Importing `biz-support-hub/backend` under `apps/biz-api` creates a clean module boundary immediately.
- Frontend Vite code stays out of the runtime path for this phase; it can be imported later after auth and shell routing are stable.

### Task 1: Freeze the source-of-truth and record the import baseline

**Files:**
- Modify: `HANDOVER.md`
- Create: `docs/superpowers/specs/platform-import-baseline.md`

- [ ] **Step 1: Write the failing documentation check**

Create a short checklist in `docs/superpowers/specs/platform-import-baseline.md` that is intentionally empty except for the required sections:

```markdown
# Platform Import Baseline

## eval-system

- commit:
- remote:
- branch:

## biz-support-hub

- commit:
- remote:
- branch:

## Verification commands

- pending
```

- [ ] **Step 2: Verify the baseline file is incomplete**

Run:

```powershell
Get-Content docs\superpowers\specs\platform-import-baseline.md
```

Expected:

- The file exists.
- The commit/remote/branch fields are blank.

- [ ] **Step 3: Fill in the baseline with actual source repository state**

Replace the file content with:

```markdown
# Platform Import Baseline

## eval-system

- commit: `9af0565`
- remote: `https://github.com/bruce0817kr/eval-system.git`
- branch: `master`

## biz-support-hub

- commit: `425632b`
- remote: `https://github.com/bruce0817kr/biz-support-hub.git`
- branch: `main`

## Verification commands

- `git status --short --branch`
- `git rev-parse --short HEAD`
- `git -C C:\Project\biz-support-hub status --short --branch`
- `git -C C:\Project\biz-support-hub rev-parse --short HEAD`
```

Also append a short note to `HANDOVER.md` that platform unification started from these two clean repos and should not proceed if either repo has uncommitted source changes.

- [ ] **Step 4: Run the verification commands**

Run:

```powershell
git status --short --branch
git rev-parse --short HEAD
git -C C:\Project\biz-support-hub status --short --branch
git -C C:\Project\biz-support-hub rev-parse --short HEAD
```

Expected:

- `eval-system` shows only `.omx/` as untracked.
- `biz-support-hub` shows a clean branch state.
- Both commit hashes are recorded in the baseline file.

- [ ] **Step 5: Commit**

```bash
git add HANDOVER.md docs/superpowers/specs/platform-import-baseline.md
git commit -m "Record clean import baseline for platform merge"
```

### Task 2: Import the FastAPI backend as `apps/biz-api`

**Files:**
- Create: `apps/biz-api/**` copied from `C:\Project\biz-support-hub\backend\`
- Create: `apps/biz-api/README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Write the failing repository structure check**

Run:

```powershell
Test-Path apps\biz-api\app\main.py
Test-Path apps\biz-api\requirements.txt
```

Expected:

- Both commands return `False`.

- [ ] **Step 2: Copy the backend into the target module boundary**

Create `apps/biz-api` from the current business backend with this command:

```powershell
New-Item -ItemType Directory -Force apps\biz-api | Out-Null
Copy-Item C:\Project\biz-support-hub\backend\app apps\biz-api -Recurse
Copy-Item C:\Project\biz-support-hub\backend\alembic apps\biz-api -Recurse
Copy-Item C:\Project\biz-support-hub\backend\scripts apps\biz-api -Recurse
Copy-Item C:\Project\biz-support-hub\backend\requirements.txt apps\biz-api
Copy-Item C:\Project\biz-support-hub\backend\alembic.ini apps\biz-api
Copy-Item C:\Project\biz-support-hub\backend\conftest.py apps\biz-api
```

Add `apps/biz-api/README.md` with:

```markdown
# biz-api

This module is imported from `biz-support-hub/backend` as the transitional business API runtime inside the unified platform repository.

Do not change API paths or auth policy in the import commit. Phase 2 only relocates the service.
```

Update `.gitignore` only if new Python runtime folders need to be ignored:

```gitignore
apps/biz-api/.venv/
apps/biz-api/.pytest_cache/
```

- [ ] **Step 3: Verify import integrity**

Run:

```powershell
Test-Path apps\biz-api\app\main.py
Test-Path apps\biz-api\requirements.txt
Get-Content apps\biz-api\app\main.py
```

Expected:

- `Test-Path` returns `True` for both files.
- `apps/biz-api/app/main.py` still exposes the FastAPI app and `/health`.

- [ ] **Step 4: Run the backend test entry points from the new path**

Run:

```powershell
cd apps\biz-api
python -m pytest -q
```

Expected:

- Existing FastAPI backend tests pass from the imported location.

- [ ] **Step 5: Commit**

```bash
git add .gitignore apps/biz-api
git commit -m "Import business backend as platform biz-api module"
```

### Task 3: Add root scripts and unified environment contract

**Files:**
- Create: `.env.platform.example`
- Create: `scripts/platform-dev.ps1`
- Create: `scripts/platform-test.ps1`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Write the failing root command check**

Run:

```powershell
npm run platform:dev
npm run platform:test
```

Expected:

- Both commands fail because the scripts do not exist yet.

- [ ] **Step 2: Add the root environment template**

Create `.env.platform.example`:

```dotenv
# Web / eval-system
DATABASE_URL="postgresql://eval:eval_secret@localhost:15432/eval_db"
REDIS_URL="redis://localhost:6380"
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET="eval-documents"
S3_REGION="us-east-1"
INTEGRATION_API_KEY="test-integration-key"

# Biz API
BIZ_DATABASE_URL="postgresql+psycopg2://postgres:postgres@localhost:5432/biz_support_hub"
SECRET_KEY="replace-this-before-shared-use"
ACCESS_TOKEN_EXPIRE_MINUTES="60"
SUPPORT_CASE_REPOSITORY_MODE="db"
ADMIN_LOGIN_ID="admin"
ADMIN_PASSWORD_HASH="replace-with-seeded-hash"
ADMIN_ROLE="ADMIN"

# Unified routing
PLATFORM_PUBLIC_URL="http://localhost:3003"
BIZ_API_INTERNAL_URL="http://127.0.0.1:8000"
```

- [ ] **Step 3: Add root developer scripts**

Create `scripts/platform-dev.ps1`:

```powershell
$ErrorActionPreference = "Stop"

Write-Host "Starting Next.js shell on :3003"
Start-Process powershell -ArgumentList @(
  "-NoProfile",
  "-Command",
  "$env:PORT='3003'; cd $PWD; npm run dev"
)

Write-Host "Starting biz-api on :8000"
Start-Process powershell -ArgumentList @(
  "-NoProfile",
  "-Command",
  "cd $PWD\\apps\\biz-api; python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
)
```

Create `scripts/platform-test.ps1`:

```powershell
$ErrorActionPreference = "Stop"

Write-Host "Running web lint/build"
npm run lint
npm run build

Write-Host "Running eval regression"
npx playwright test tests/integration-api.spec.ts tests/eval-api-coverage.spec.ts tests/eval-full-simulation.spec.ts --workers=1

Write-Host "Running biz-api regression"
Push-Location apps/biz-api
python -m pytest -q
Pop-Location
```

Modify `package.json` scripts:

```json
{
  "scripts": {
    "platform:dev": "powershell -ExecutionPolicy Bypass -File .\\scripts\\platform-dev.ps1",
    "platform:test": "powershell -ExecutionPolicy Bypass -File .\\scripts\\platform-test.ps1"
  }
}
```

- [ ] **Step 4: Verify the new command surface**

Run:

```powershell
npm run platform:test
```

Expected:

- Next.js lint/build runs.
- eval Playwright regression runs.
- `apps/biz-api` pytest suite runs.

- [ ] **Step 5: Commit**

```bash
git add .env.platform.example package.json README.md scripts/platform-dev.ps1 scripts/platform-test.ps1
git commit -m "Add root platform scripts and unified env contract"
```

### Task 4: Add one-stack deployment wiring for web + biz-api

**Files:**
- Create: `infra/docker-compose.platform.yml`
- Create: `infra/proxy/platform.nginx.conf`
- Modify: `README.md`
- Modify: `HANDOVER.md`

- [ ] **Step 1: Write the failing deployment path check**

Run:

```powershell
Test-Path infra\docker-compose.platform.yml
Test-Path infra\proxy\platform.nginx.conf
```

Expected:

- Both commands return `False`.

- [ ] **Step 2: Add the unified compose file**

Create `infra/docker-compose.platform.yml`:

```yaml
services:
  web:
    build:
      context: ..
      dockerfile: Dockerfile
    env_file:
      - ../.env.local
    depends_on:
      - biz-api
      - postgres
      - redis
      - minio

  biz-api:
    build:
      context: ../apps/biz-api
      dockerfile: Dockerfile
    env_file:
      - ../.env.platform.example
    command: python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

  proxy:
    image: nginx:1.27-alpine
    volumes:
      - ./proxy/platform.nginx.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "3003:80"
    depends_on:
      - web
      - biz-api

  postgres:
    image: postgres:16-alpine

  redis:
    image: redis:7-alpine

  minio:
    image: minio/minio:latest
```

Create `infra/proxy/platform.nginx.conf`:

```nginx
server {
  listen 80;

  location /api/biz/ {
    rewrite ^/api/biz/(.*)$ /api/v1/$1 break;
    proxy_pass http://biz-api:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://web:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

- [ ] **Step 3: Verify the compose and proxy configuration**

Run:

```powershell
docker compose -f infra\docker-compose.platform.yml config
```

Expected:

- Compose config renders without syntax errors.

- [ ] **Step 4: Smoke the unified route boundary**

Run:

```powershell
docker compose -f infra\docker-compose.platform.yml up -d proxy web biz-api
Invoke-WebRequest http://localhost:3003/api/health -UseBasicParsing
Invoke-WebRequest http://localhost:3003/api/biz/health -UseBasicParsing
```

Expected:

- `/api/health` returns the Next.js health payload.
- `/api/biz/health` returns the FastAPI health payload.

- [ ] **Step 5: Commit**

```bash
git add HANDOVER.md README.md infra/docker-compose.platform.yml infra/proxy/platform.nginx.conf
git commit -m "Add unified platform deployment boundary"
```

### Task 5: Final phase verification and handoff

**Files:**
- Modify: `HANDOVER.md`
- Modify: `README.md`

- [ ] **Step 1: Write the failing handoff check**

Run:

```powershell
rg -n "platform:dev|platform:test|apps/biz-api|api/biz" README.md HANDOVER.md
```

Expected:

- Missing or incomplete references before handoff updates.

- [ ] **Step 2: Update documentation for the new operational path**

Append to `HANDOVER.md`:

```markdown
### Platform phase 0-2
- biz-support-hub backend imported into `apps/biz-api`
- root commands added:
  - `npm run platform:dev`
  - `npm run platform:test`
- unified route boundary:
  - `/api/*` -> Next.js
  - `/api/biz/*` -> FastAPI `/api/v1/*`
- Vite frontend not yet migrated; still transitional and not user-facing in the unified shell
```

Update `README.md` to include:

```markdown
## Platform mode

Run both services from the platform repo:

```powershell
npm run platform:dev
```

Run unified regression:

```powershell
npm run platform:test
```

FastAPI business endpoints are exposed through the platform boundary under `/api/biz/*`.
```

- [ ] **Step 3: Run the full phase verification**

Run:

```powershell
npm run platform:test
docker compose -f infra\docker-compose.platform.yml config
```

Expected:

- Root regression passes.
- Deployment config renders successfully.

- [ ] **Step 4: Confirm spec coverage**

Manual checklist:

- monorepo/module boundary created
- one deployment stack boundary added
- one domain routing path established
- unified env/template added
- no auth rewrite attempted yet
- Vite UI deferred explicitly

Expected:

- All six items are true.

- [ ] **Step 5: Commit**

```bash
git add README.md HANDOVER.md
git commit -m "Document platform phase 0-2 operating model"
```

## Self-Review

- Spec coverage: this plan covers Phase 0, Phase 1, and Phase 2 from the approved design. It intentionally does not implement unified auth or Vite-to-Next UI migration.
- Placeholder scan: no `TBD` or `TODO` markers remain in tasks; all commands, paths, and config snippets are explicit.
- Type consistency: route boundary is consistently `/api/biz/* -> /api/v1/*`, and imported FastAPI module path is consistently `apps/biz-api`.
