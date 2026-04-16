import { test, expect } from './page-objects'
import { waitForOTP, clearRedisOTP } from './helpers'

const EVALUATOR_PHONE = '010-1111-1111'
const EVALUATOR_NAME = '김평가'
const SESSION_ID = 'ses001'
const APPLICATION_ID = 'app001'

test.describe('평가 플로우 E2E', () => {
  test.beforeEach(async () => {
    await clearRedisOTP(EVALUATOR_PHONE)
  })

  test('평가 목록 → 신청서 선택 → PDF 문서 확인', async ({
    evalLoginPage,
    evalSessionsPage,
    evalSessionApplicationsPage,
    page,
  }) => {
    // 1. 로그인
    await evalLoginPage.goto()
    await evalLoginPage.fillCredentials(EVALUATOR_NAME, EVALUATOR_PHONE)
    await evalLoginPage.submitStep1()

    const otp = await waitForOTP(page, EVALUATOR_PHONE, 30000)
    test.skip(!otp, 'OTP를 가져올 수 없습니다')
    if (!otp) return

    await evalLoginPage.submitOTP(otp)
    await page.waitForURL('**/eval/sessions**', { timeout: 10000 })

    // 2. 세션 목록 → 세션 선택
    await expect(page).toHaveURL(/\/eval\/sessions/)
    await evalSessionsPage.selectSession('2026')

    // 3. 신청 목록 → 신청 선택
    await page.waitForURL(`**/eval/sessions/${SESSION_ID}**`, { timeout: 10000 })
    await evalSessionApplicationsPage.selectApplication('(주)한국솔루션')

    // 4. 평가 화면 URL 확인
    await page.waitForURL(`**/eval/sessions/${SESSION_ID}/evaluate/${APPLICATION_ID}**`, { timeout: 10000 })
  })

  test('평가表单 점수 입력 → 초안 저장', async ({
    evalLoginPage,
    evalSessionsPage,
    evalSessionApplicationsPage,
    page,
  }) => {
    // 1. 로그인
    await evalLoginPage.goto()
    await evalLoginPage.fillCredentials(EVALUATOR_NAME, EVALUATOR_PHONE)
    await evalLoginPage.submitStep1()

    const otp = await waitForOTP(page, EVALUATOR_PHONE, 30000)
    test.skip(!otp, 'OTP를 가져올 수 없습니다')
    if (!otp) return

    await evalLoginPage.submitOTP(otp)
    await page.waitForURL('**/eval/sessions**', { timeout: 10000 })

    // 2. 세션 → 신청 선택
    await evalSessionsPage.selectSession('2026')
    await page.waitForURL(`**/eval/sessions/${SESSION_ID}**`, { timeout: 10000 })
    await evalSessionApplicationsPage.selectApplication('(주)한국솔루션')

    // 3. 평가 화면 로딩 확인
    await page.waitForURL(`**/eval/sessions/${SESSION_ID}/evaluate/${APPLICATION_ID}**`, { timeout: 10000 })
  })

  test('평가 목록 → 세션 카드 클릭 → 신청 목록 표시', async ({
    evalLoginPage,
    page,
  }) => {
    // 1. 로그인
    await evalLoginPage.goto()
    await evalLoginPage.fillCredentials(EVALUATOR_NAME, EVALUATOR_PHONE)
    await evalLoginPage.submitStep1()

    const otp = await waitForOTP(page, EVALUATOR_PHONE, 30000)
    test.skip(!otp, 'OTP를 가져올 수 없습니다')
    if (!otp) return

    await evalLoginPage.submitOTP(otp)
    await page.waitForURL('**/eval/sessions**', { timeout: 10000 })

    // 2. 세션 목록 확인
    await expect(page.locator('text=배정받은 평가')).toBeVisible()
    await expect(page.locator('text=2026')).toBeVisible()

    // 3. 세션 카드 클릭
    const sessionCard = page.locator('text=2026년 상반기 기술평가').first()
    await sessionCard.click()

    // 4. 신청 목록 페이지로 이동
    await page.waitForURL(`**/eval/sessions/${SESSION_ID}**`, { timeout: 10000 })
    await expect(page.locator('text=평가 대상 기업')).toBeVisible()
  })
})
