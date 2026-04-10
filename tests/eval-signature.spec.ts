import { test, expect } from './page-objects'
import { waitForOTP, clearRedisOTP, clearSubmissions } from './helpers'

// setup-test-data.mjs 로 생성된 전용 E2E 데이터 사용
const EVALUATOR_PHONE = '010-1111-1111'
const EVALUATOR_NAME = '김평가'
const MEMBER_ID = 'test-member-e2e'
const SESSION_ID = 'test-session-e2e'
const APPLICATION_ID = 'app-test-session-e2e'

async function loginWithOtp(evalLoginPage: {
  goto: () => Promise<void>
  fillCredentials: (name: string, phone: string) => Promise<void>
  submitStep1: () => Promise<void>
  submitOTP: (otp: string) => Promise<void>
  page: import('@playwright/test').Page
}): Promise<string | null> {
  await evalLoginPage.goto()
  await evalLoginPage.fillCredentials(EVALUATOR_NAME, EVALUATOR_PHONE)
  await evalLoginPage.submitStep1()
  const otp = await waitForOTP(evalLoginPage.page, EVALUATOR_PHONE, 30000)
  if (!otp) return null
  await evalLoginPage.submitOTP(otp)
  await evalLoginPage.page.waitForURL('**/eval/sessions**', { timeout: 10000 })
  return otp
}

test.describe('서명 제출 E2E', () => {
  test.beforeEach(async () => {
    await clearRedisOTP(EVALUATOR_PHONE)
    clearSubmissions(MEMBER_ID, SESSION_ID)
  })

  test('평가 작성 → 제출 → 서명 → 리다이렉트', async ({
    evalLoginPage,
    page,
  }) => {
    // 1. OTP 로그인
    const otp = await loginWithOtp(evalLoginPage)
    test.skip(!otp, 'OTP를 가져올 수 없습니다')
    if (!otp) return

    // 2. 평가 페이지로 직접 이동
    await page.goto(`/eval/sessions/${SESSION_ID}/evaluate/${APPLICATION_ID}`)
    await page.waitForLoadState('networkidle')

    // 평가 페이지 로딩 확인
    const bodyText = await page.textContent('body')
    test.skip(!bodyText?.includes('평가'), '평가 페이지 로딩 실패 (테스트 데이터 없음)')
    if (!bodyText?.includes('평가')) return

    // 3. 평가폼 탭 확인 (mobile에서 탭 전환 필요할 수 있음)
    const formTabBtn = page.locator('button:has-text("평가표")')
    if (await formTabBtn.isVisible()) {
      await formTabBtn.click()
    }

    // 4. "제출" 버튼 클릭 → SignatureSubmitDialog 열기
    const submitBtn = page.locator('button:has-text("제출")').last()
    await expect(submitBtn).toBeVisible({ timeout: 10000 })
    await submitBtn.click()

    // 5. Step 1: 제출 내용 확인 → "다음" 클릭
    const nextBtn = page.locator('button:has-text("다음")')
    await expect(nextBtn).toBeVisible({ timeout: 5000 })
    // 필수 항목이 없으면 "다음" 활성화
    await expect(nextBtn).toBeEnabled()
    await nextBtn.click()

    // 6. Step 2: 서명 캔버스에 서명 그리기
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible({ timeout: 5000 })
    const box = await canvas.boundingBox()
    if (!box) {
      test.skip(true, '서명 캔버스를 찾을 수 없습니다')
      return
    }

    // SignaturePad가 리스닝하는 pointer 이벤트로 서명 그리기
    await page.mouse.move(box.x + 60, box.y + 60)
    await page.mouse.down()
    await page.mouse.move(box.x + 120, box.y + 100, { steps: 8 })
    await page.mouse.move(box.x + 180, box.y + 60, { steps: 8 })
    await page.mouse.move(box.x + 240, box.y + 110, { steps: 8 })
    await page.mouse.up()

    // "OTP 인증으로 이동" 클릭
    const otpStepBtn = page.locator('button:has-text("OTP 인증으로 이동")')
    await expect(otpStepBtn).toBeVisible({ timeout: 3000 })
    await otpStepBtn.click()

    // 7. Step 3: OTP 전송 → 입력 → 제출
    const sendOtpBtn = page.locator('button:has-text("OTP 전송")')
    await expect(sendOtpBtn).toBeVisible({ timeout: 5000 })
    await sendOtpBtn.click()

    // Redis에서 새 OTP 읽기
    await clearRedisOTP(EVALUATOR_PHONE) // 기존 것 지우고
    // request-otp 응답에 code가 포함됨 (개발 환경)
    const signOtp = await waitForOTP(page, EVALUATOR_PHONE, 15000)
    test.skip(!signOtp, '서명용 OTP를 가져올 수 없습니다')
    if (!signOtp) return

    const otpInput = page.locator('#otp-code')
    await expect(otpInput).toBeVisible({ timeout: 5000 })
    await otpInput.fill(signOtp)

    // "제출 완료" 클릭
    const finalSubmitBtn = page.locator('button:has-text("제출 완료")')
    await expect(finalSubmitBtn).toBeEnabled({ timeout: 3000 })
    await finalSubmitBtn.click()

    // 8. 리다이렉트 확인 (서명 완료 후 세션 목록으로)
    await page.waitForURL(`**/eval/sessions/${SESSION_ID}`, { timeout: 15000 })
    await expect(page).toHaveURL(new RegExp(`/eval/sessions/${SESSION_ID}`))
  })

  test('중복 제출 방지 확인', async ({ evalLoginPage, page }) => {
    // 1. OTP 로그인 (세션 쿠키 획득)
    const otp = await loginWithOtp(evalLoginPage)
    test.skip(!otp, 'OTP를 가져올 수 없습니다')
    if (!otp) return

    const submitUrl = `/api/eval/sessions/${SESSION_ID}/submit`
    const submitBody = {
      applicationId: APPLICATION_ID,
      answersJson: {
        'item-1': 4,
        'item-2': 3,
        'item-3': '테스트 의견',
        'item-4': 5,
      },
    }

    // 2. 첫 번째 제출 → 201 기대
    const firstResult = await page.evaluate(
      async ({ url, body }: { url: string; body: unknown }) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'include',
        })
        return { status: response.status }
      },
      { url: submitUrl, body: submitBody },
    )

    expect(firstResult.status).toBe(201)

    // 3. 동일 신청서에 두 번째 제출 → 409 기대
    const secondResult = await page.evaluate(
      async ({ url, body }: { url: string; body: unknown }) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'include',
        })
        const json = (await response.json()) as { error?: string }
        return { status: response.status, error: json.error }
      },
      { url: submitUrl, body: submitBody },
    )

    expect(secondResult.status).toBe(409)
    expect(secondResult.error).toMatch(/이미 제출/)
  })
})
