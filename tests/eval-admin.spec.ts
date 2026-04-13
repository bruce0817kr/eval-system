import { test, expect } from './page-objects'
import type { Page } from '@playwright/test'
import { clearAdminRateLimit } from './helpers'

const ADMIN_EMAIL = 'testadmin@test.com'
const ADMIN_PASSWORD = 'TestAdmin123!'

async function adminLogin(page: Page) {
  await page.goto('/admin/login')
  const credentials = { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  await page.evaluate(async (creds) => {
    await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds)
    })
  }, credentials)
  await page.goto('/admin/dashboard')
  await page.waitForLoadState('networkidle')
}

test.describe('관리자 로그인', () => {
  test.beforeEach(async () => {
    await clearAdminRateLimit()
  })

  test('잘못된 비밀번호 → 에러 메시지 표시', async ({ page }) => {
    await page.goto('/admin/login')
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', 'WrongPassword!!1')
    await page.click('button[type="submit"]')
    await expect(
      page.locator('text=이메일 또는 비밀번호가 올바르지 않습니다'),
    ).toBeVisible({ timeout: 5000 })
  })

  test('관리자 로그인 페이지가 렌더링된다', async ({ page }) => {
    await page.goto('/admin/login')
    await expect(page.locator('text=관리자 로그인')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('관리자 로그인 → 대시보드', async ({ page }) => {
    await adminLogin(page)
    await expect(page).toHaveURL(/\/admin\/dashboard/)
  })

  test('관리자 대시보드 렌더링', async ({ page }) => {
    await adminLogin(page)
    await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible()
  })
})

test.describe('관리자 세션 관리', () => {
  test.beforeEach(async ({ page }) => {
    await clearAdminRateLimit()
    await adminLogin(page)
  })

  test('세션 목록 페이지', async ({ page }) => {
    await page.goto('/admin/sessions')
    await page.waitForLoadState('networkidle')
    const content = await page.textContent('body')
    expect(content).toMatch(/세션|평가|session/i)
  })

  test('평가위원 목록 페이지', async ({ page }) => {
    await page.goto('/admin/committee')
    await page.waitForLoadState('networkidle')
    const content = await page.textContent('body')
    expect(content).toMatch(/평가위원|위원|member|committee/i)
  })

  test('기업 목록 페이지', async ({ page }) => {
    await page.goto('/admin/companies')
    await page.waitForLoadState('networkidle')
    const content = await page.textContent('body')
    expect(content).toMatch(/기업|company/i)
  })
})
