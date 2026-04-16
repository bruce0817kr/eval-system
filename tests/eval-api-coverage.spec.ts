import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { clearAdminRateLimit } from './helpers'

const ADMIN_EMAIL = 'testadmin@test.com'
const ADMIN_PASSWORD = 'TestAdmin123!'
const SESSION_ID = 'test-session-e2e'
const APPLICATION_ID = 'app-test-session-e2e'

async function loginAdmin(page: Page): Promise<void> {
  await clearAdminRateLimit()
  await page.goto('/')
  await page.evaluate(
    async ({ email, password }: { email: string; password: string }) => {
      await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      })
    },
    { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  )
}

// ── /api/admin/me ─────────────────────────────────────────────────────────────

test.describe('/api/admin/me', () => {
  test('인증 없이 GET → 401', async ({ page }) => {
    await page.goto('/')
    const status = await page.evaluate(async () => {
      const resp = await fetch('/api/admin/me')
      return resp.status
    })
    expect(status).toBe(401)
  })

  test('인증 후 GET → 200 + 사용자 정보 반환', async ({ page }) => {
    await loginAdmin(page)
    const result = await page.evaluate(async () => {
      const resp = await fetch('/api/admin/me', { credentials: 'include' })
      const body = (await resp.json()) as { email: string }
      return { status: resp.status, email: body.email }
    })
    expect(result.status).toBe(200)
    expect(result.email).toBe(ADMIN_EMAIL)
  })
})

// ── /api/admin/auth/register ──────────────────────────────────────────────────

test.describe('/api/admin/auth/register', () => {
  test('admin 존재 시 세션 없이 POST → 403', async ({ page }) => {
    await page.goto('/')
    const status = await page.evaluate(async () => {
      const resp = await fetch('/api/admin/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'newuser-coverage@test.com',
          password: 'TestPass123!',
          name: '신규관리자',
          role: 'operator',
        }),
      })
      return resp.status
    })
    expect(status).toBe(403)
  })
})

// ── /api/admin/audit-log ──────────────────────────────────────────────────────

test.describe('/api/admin/audit-log', () => {
  test('인증 없이 GET → 401', async ({ page }) => {
    await page.goto('/')
    const status = await page.evaluate(async () => {
      const resp = await fetch('/api/admin/audit-log')
      return resp.status
    })
    expect(status).toBe(401)
  })

  test('인증 후 GET → 200 + 페이지네이션 필드 포함', async ({ page }) => {
    await loginAdmin(page)
    const result = await page.evaluate(async () => {
      const resp = await fetch('/api/admin/audit-log?pageSize=5', {
        credentials: 'include',
      })
      const body = (await resp.json()) as {
        events: unknown[]
        page: number
        pageSize: number
        total: number
        totalPages: number
      }
      return { status: resp.status, pageSize: body.pageSize, hasEvents: Array.isArray(body.events) }
    })
    expect(result.status).toBe(200)
    expect(result.hasEvents).toBe(true)
    expect(result.pageSize).toBe(5)
  })

  test('actorType=admin 필터 → 결과가 모두 admin', async ({ page }) => {
    await loginAdmin(page)
    const result = await page.evaluate(async () => {
      const resp = await fetch('/api/admin/audit-log?actorType=admin&pageSize=10', {
        credentials: 'include',
      })
      const body = (await resp.json()) as { events: Array<{ actorType: string }> }
      return { status: resp.status, types: body.events.map((e) => e.actorType) }
    })
    expect(result.status).toBe(200)
    for (const t of result.types) {
      expect(t).toBe('admin')
    }
  })
})

// ── /api/admin/auth/password ──────────────────────────────────────────────────

test.describe('/api/admin/auth/password', () => {
  test('인증 없이 POST → 401', async ({ page }) => {
    await page.goto('/')
    const status = await page.evaluate(async () => {
      const resp = await fetch('/api/admin/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: 'anything', newPassword: 'NewPass123!' }),
      })
      return resp.status
    })
    expect(status).toBe(401)
  })

  test('현재 비밀번호 틀림 → 400', async ({ page }) => {
    await loginAdmin(page)
    const result = await page.evaluate(async () => {
      const resp = await fetch('/api/admin/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: 'WrongPass!!', newPassword: 'NewPass123!' }),
        credentials: 'include',
      })
      const body = (await resp.json()) as { error: string }
      return { status: resp.status, error: body.error }
    })
    expect(result.status).toBe(400)
    expect(result.error).toMatch(/현재 비밀번호/)
  })

  test('새 비밀번호 8자 미만 → 400', async ({ page }) => {
    await loginAdmin(page)
    const result = await page.evaluate(async () => {
      const resp = await fetch('/api/admin/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: 'TestAdmin123!', newPassword: 'short' }),
        credentials: 'include',
      })
      const body = (await resp.json()) as { error: string }
      return { status: resp.status, error: body.error }
    })
    expect(result.status).toBe(400)
    expect(result.error).toMatch(/8자/)
  })

  test('정상 변경 → 200, 원래 비밀번호로 복원', async ({ page }) => {
    await loginAdmin(page)
    const TEMP = 'TempPass789!'

    // 임시 비밀번호로 변경
    const r1 = await page.evaluate(
      async ({ cur, next }: { cur: string; next: string }) => {
        const resp = await fetch('/api/admin/auth/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: cur, newPassword: next }),
          credentials: 'include',
        })
        return resp.status
      },
      { cur: ADMIN_PASSWORD, next: TEMP },
    )
    expect(r1).toBe(200)

    // 세션이 지워졌으므로 임시 비밀번호로 재로그인
    await clearAdminRateLimit()
    await page.evaluate(
      async ({ email, pass }: { email: string; pass: string }) => {
        await fetch('/api/admin/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: pass }),
          credentials: 'include',
        })
      },
      { email: ADMIN_EMAIL, pass: TEMP },
    )

    // 원래 비밀번호로 복원
    const r2 = await page.evaluate(
      async ({ cur, next }: { cur: string; next: string }) => {
        const resp = await fetch('/api/admin/auth/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: cur, newPassword: next }),
          credentials: 'include',
        })
        return resp.status
      },
      { cur: TEMP, next: ADMIN_PASSWORD },
    )
    expect(r2).toBe(200)
  })
})

// ── Application CRUD ──────────────────────────────────────────────────────────

test.describe('Application 관리 API', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page)
  })

  test('GET → 200 + applicationId 포함', async ({ page }) => {
    const result = await page.evaluate(
      async ({ sid, aid }: { sid: string; aid: string }) => {
        const resp = await fetch(
          `/api/admin/sessions/${sid}/applications/${aid}`,
          { credentials: 'include' },
        )
        const body = (await resp.json()) as { id: string }
        return { status: resp.status, id: body.id }
      },
      { sid: SESSION_ID, aid: APPLICATION_ID },
    )
    expect(result.status).toBe(200)
    expect(result.id).toBe(APPLICATION_ID)
  })

  test('존재하지 않는 applicationId → 404', async ({ page }) => {
    const status = await page.evaluate(
      async (sid: string) => {
        const resp = await fetch(
          `/api/admin/sessions/${sid}/applications/nonexistent-app-id`,
          { credentials: 'include' },
        )
        return resp.status
      },
      SESSION_ID,
    )
    expect(status).toBe(404)
  })

  test('PATCH notes 수정 → 200', async ({ page }) => {
    const status = await page.evaluate(
      async ({ sid, aid }: { sid: string; aid: string }) => {
        const resp = await fetch(
          `/api/admin/sessions/${sid}/applications/${aid}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: null }),
            credentials: 'include',
          },
        )
        return resp.status
      },
      { sid: SESSION_ID, aid: APPLICATION_ID },
    )
    expect(status).toBe(200)
  })

  test('DELETE 존재하지 않는 application → 404', async ({ page }) => {
    const status = await page.evaluate(
      async (sid: string) => {
        const resp = await fetch(
          `/api/admin/sessions/${sid}/applications/nonexistent-app-id`,
          { method: 'DELETE', credentials: 'include' },
        )
        return resp.status
      },
      SESSION_ID,
    )
    expect(status).toBe(404)
  })

  test('DELETE 제출 있는 application → 409', async ({ page }) => {
    // app-test-session-e2e는 eval-signature.spec.ts 실행 후 제출 기록을 가짐
    // 제출 없을 경우 200으로 삭제될 수 있으므로 beforeAll에서 제출 상태 보장 필요
    const status = await page.evaluate(
      async ({ sid, aid }: { sid: string; aid: string }) => {
        // GET으로 제출 수 확인
        const getResp = await fetch(
          `/api/admin/sessions/${sid}/applications/${aid}`,
          { credentials: 'include' },
        )
        const app = (await getResp.json()) as {
          evaluationSubmissions: unknown[]
        }
        if (!app.evaluationSubmissions || app.evaluationSubmissions.length === 0) {
          return -1 // 제출 없음: 테스트 스킵 마커
        }
        const delResp = await fetch(
          `/api/admin/sessions/${sid}/applications/${aid}`,
          { method: 'DELETE', credentials: 'include' },
        )
        return delResp.status
      },
      { sid: SESSION_ID, aid: APPLICATION_ID },
    )

    if (status === -1) {
      test.skip(true, '제출 기록이 없어 409 테스트 스킵 (eval-signature.spec.ts 먼저 실행 필요)')
      return
    }
    expect(status).toBe(409)
  })
})

// ── Application Documents ─────────────────────────────────────────────────────

test.describe('Application 문서 API', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page)
  })

  test('GET 문서 목록 → 200 + documents 배열', async ({ page }) => {
    const result = await page.evaluate(
      async ({ sid, aid }: { sid: string; aid: string }) => {
        const resp = await fetch(
          `/api/admin/sessions/${sid}/applications/${aid}/documents`,
          { credentials: 'include' },
        )
        const body = (await resp.json()) as { documents: unknown[] }
        return { status: resp.status, isArray: Array.isArray(body.documents) }
      },
      { sid: SESSION_ID, aid: APPLICATION_ID },
    )
    expect(result.status).toBe(200)
    expect(result.isArray).toBe(true)
  })

  test('POST 업로드 → 201, DELETE 삭제 → 200', async ({ page }) => {
    const uploadResult = await page.evaluate(
      async ({ sid, aid }: { sid: string; aid: string }) => {
        const blob = new Blob(['%PDF-1.4 coverage test'], { type: 'application/pdf' })
        const file = new File([blob], 'coverage-test.pdf', { type: 'application/pdf' })
        const form = new FormData()
        form.append('file', file)
        const resp = await fetch(
          `/api/admin/sessions/${sid}/applications/${aid}/documents`,
          { method: 'POST', body: form, credentials: 'include' },
        )
        const body = (await resp.json()) as { id?: string }
        return { status: resp.status, id: body.id ?? null }
      },
      { sid: SESSION_ID, aid: APPLICATION_ID },
    )
    expect(uploadResult.status).toBe(201)
    expect(uploadResult.id).toBeTruthy()

    const deleteStatus = await page.evaluate(
      async ({ sid, aid, docId }: { sid: string; aid: string; docId: string }) => {
        const resp = await fetch(
          `/api/admin/sessions/${sid}/applications/${aid}/documents?documentId=${docId}`,
          { method: 'DELETE', credentials: 'include' },
        )
        return resp.status
      },
      { sid: SESSION_ID, aid: APPLICATION_ID, docId: uploadResult.id! },
    )
    expect(deleteStatus).toBe(200)
  })
})

// ── Rate Limiting ─────────────────────────────────────────────────────────────

test.describe('관리자 로그인 Rate Limiting', () => {
  // 테스트 전용 IP (RFC 5737 TEST-NET)
  const TEST_IP = '192.0.2.99'

  test.beforeEach(async () => {
    await clearAdminRateLimit()
  })

  test('10회 실패 후 11번째 요청 → 429', async ({ page }) => {
    await page.goto('/')

    for (let i = 0; i < 10; i++) {
      const status = await page.evaluate(
        async (ip: string) => {
          const resp = await fetch('/api/admin/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Real-IP': ip,
            },
            body: JSON.stringify({ email: 'ratelimit@test.com', password: 'wrongpass' }),
          })
          return resp.status
        },
        TEST_IP,
      )
      expect(status).toBe(401)
    }

    const blockedStatus = await page.evaluate(
      async (ip: string) => {
        const resp = await fetch('/api/admin/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Real-IP': ip,
          },
          body: JSON.stringify({ email: 'ratelimit@test.com', password: 'wrongpass' }),
        })
        return resp.status
      },
      TEST_IP,
    )
    expect(blockedStatus).toBe(429)
  })
})
