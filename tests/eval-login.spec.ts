import { test, expect } from './page-objects'
import { getOTPFromRedis, waitForOTP, clearRedisOTP } from './helpers'

const EVALUATOR_PHONE = process.env.E2E_EVALUATOR_PHONE || '01011111111'
const EVALUATOR_NAME = process.env.E2E_EVALUATOR_NAME || '김평가'

test.describe('평가위원 로그인', () => {
  test.beforeEach(async () => {
    await clearRedisOTP(EVALUATOR_PHONE)
  })

  test('OTP 요청 시 인증번호와 안내 메시지가 표시된다', async ({
    evalLoginPage,
  }) => {
    await evalLoginPage.goto()
    await evalLoginPage.fillCredentials(EVALUATOR_NAME, EVALUATOR_PHONE)

    await evalLoginPage.submitStep1()

    const otpCard = evalLoginPage.page.locator('.border-primary\\/20')
    await expect(otpCard).toBeVisible()

    const codeText = await otpCard.textContent()
    expect(codeText).toMatch(/인증번호:/)
    expect(codeText).toMatch(/1666-3538/)
  })

  test('정상 로그인 후 세션 목록으로 이동한다', async ({
    evalLoginPage,
    page,
  }) => {
    await evalLoginPage.goto()
    await evalLoginPage.fillCredentials(EVALUATOR_NAME, EVALUATOR_PHONE)

    await evalLoginPage.submitStep1()

    const otp = await waitForOTP(page, EVALUATOR_PHONE)
    expect(otp).not.toBeNull()
    expect(otp).toMatch(/^\d{6}$/)

    await evalLoginPage.submitOTP(otp!)

    await page.waitForURL('**/eval/sessions**', { timeout: 10000 })
    await expect(page).toHaveURL(/\/eval\/sessions/)
  })
})

test.describe('OCTOMO SMS OTP', () => {
  const testPhone = '01099990001'
  const testCode = '123456'

  test(' OCTOMO API 응답 검증', async () => {
    const response = await fetch(
      'https://api.octoverse.kr/octomo/v1/public/message/exists',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Octomo ${process.env.OCTOMO_API_KEY || ''}`,
        },
        body: JSON.stringify({ mobileNum: testPhone, text: testCode }),
      },
    )

    expect(response.ok).toBeTruthy()
    const result = (await response.json()) as { verified: boolean }
    expect(typeof result.verified).toBe('boolean')
  })
})
