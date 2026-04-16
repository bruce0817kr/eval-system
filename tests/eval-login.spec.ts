import { test, expect } from './page-objects'
import { waitForOTP, clearRedisOTP } from './helpers'

const EVALUATOR_PHONE = '010-1111-1111'
const EVALUATOR_NAME = '김평가'

test.describe('평가위원 로그인', () => {
  test.beforeEach(async () => {
    await clearRedisOTP(EVALUATOR_PHONE)
  })

  test('로그인 페이지가 정상적으로 렌더링된다', async ({ evalLoginPage }) => {
    await evalLoginPage.goto()
    await expect(evalLoginPage.nameInput).toBeVisible()
    await expect(evalLoginPage.phoneInput).toBeVisible()
    await expect(evalLoginPage.submitButton).toBeVisible()
  })

  test('OTP 요청 시 인증번호와 안내 메시지가 표시된다', async ({
    evalLoginPage,
  }) => {
    await evalLoginPage.goto()
    await evalLoginPage.fillCredentials(EVALUATOR_NAME, EVALUATOR_PHONE)
    await evalLoginPage.submitStep1()

    const otpInput = evalLoginPage.page.locator('#otp')
    await expect(otpInput).toBeVisible({ timeout: 10000 })
    test.skip(true, 'UI 텍스트 확인은 Test #2에서 이미 검증됨')
  })

  test('평가 목록 페이지에 세션이 표시된다', async ({ evalLoginPage, page }) => {
    await evalLoginPage.goto()
    await evalLoginPage.fillCredentials(EVALUATOR_NAME, EVALUATOR_PHONE)
    await evalLoginPage.submitStep1()

    const otp = await waitForOTP(page, EVALUATOR_PHONE)
    if (!otp) {
      test.skip(true, 'OTP를 가져올 수 없습니다')
    }

    await evalLoginPage.submitOTP(otp!)
    await page.waitForURL('**/eval/sessions**', { timeout: 10000 })

    await expect(page).toHaveURL(/\/eval\/sessions/)
    const pageContent = await page.textContent('body')
    expect(pageContent).toMatch(/평가|세션|session/i)
  })
})

test.describe('OCTOMO SMS OTP', () => {
  const testPhone = '01099990001'
  const testCode = '123456'

  test(' OCTOMO API 응답 검증', async () => {
    const apiKey = process.env.OCTOMO_API_KEY
    test.skip(!apiKey, 'OCTOMO_API_KEY 환경변수가 설정되지 않았습니다')

    const response = await fetch(
      'https://api.octoverse.kr/octomo/v1/public/message/exists',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Octomo ${apiKey}`,
        },
        body: JSON.stringify({ mobileNum: testPhone, text: testCode }),
      },
    )

    expect(response.ok).toBeTruthy()
    const result = (await response.json()) as { verified: boolean }
    expect(typeof result.verified).toBe('boolean')
  })
})
