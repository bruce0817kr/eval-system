import { test as base, type Page, type Locator } from '@playwright/test'

export { expect } from '@playwright/test'

export class EvalLoginPage {
  readonly page: Page
  readonly nameInput: Locator
  readonly phoneInput: Locator
  readonly submitButton: Locator
  readonly otpInput: Locator

  constructor(page: Page) {
    this.page = page
    this.nameInput = page.locator('#name')
    this.phoneInput = page.locator('#phone')
    this.submitButton = page.locator('button[type="submit"]')
    this.otpInput = page.locator('#otp')
  }

  async goto() {
    await this.page.goto('/eval/login')
  }

  async fillCredentials(name: string, phone: string) {
    await this.nameInput.fill(name)
    await this.phoneInput.fill(phone)
  }

  async submitStep1() {
    await this.submitButton.click()
    await this.page.waitForSelector('#otp', { timeout: 10000 })
  }

  async submitOTP(otp: string) {
    await this.otpInput.fill(otp)
    await this.submitButton.click()
  }
}

export class EvalSessionsPage {
  readonly page: Page
  readonly sessionCards: Locator

  constructor(page: Page) {
    this.page = page
    this.sessionCards = page.locator('.cursor-pointer')
  }

  async goto() {
    await this.page.goto('/eval/sessions')
  }

  async selectSession(sessionTitle: string) {
    await this.page.locator(`text=${sessionTitle}`).click()
  }
}

export class EvalSessionApplicationsPage {
  readonly page: Page
  readonly applicationCards: Locator

  constructor(page: Page) {
    this.page = page
    this.applicationCards = page.locator('.cursor-pointer')
  }

  async selectApplication(companyName: string) {
    await this.page.locator(`.cursor-pointer:has-text("${companyName}")`).click()
  }
}

export class EvalEvaluationPage {
  readonly page: Page
  readonly pdfTab: Locator
  readonly formTab: Locator
  readonly saveDraftButton: Locator
  readonly submitButton: Locator

  constructor(page: Page) {
    this.page = page
    this.pdfTab = page.locator('button:has-text("PDF 문서")')
    this.formTab = page.locator('button:has-text("평가표")')
    this.saveDraftButton = page.locator('button:has-text("초안 저장")')
    this.submitButton = page.locator('button:has-text("제출")')
  }

  async waitForLoad() {
    await this.page.waitForSelector('text=평가 대상 기업', { timeout: 10000 })
  }

  async waitForEvaluationPage() {
    await this.page.waitForSelector('text=작성', { timeout: 10000 })
  }
}

export const test = base.extend<{
  evalLoginPage: EvalLoginPage
  evalSessionsPage: EvalSessionsPage
  evalSessionApplicationsPage: EvalSessionApplicationsPage
  evalEvaluationPage: EvalEvaluationPage
}>({
  evalLoginPage: async ({ page }, fixtureUse) => {
    const evalLoginPage = new EvalLoginPage(page)
    await fixtureUse(evalLoginPage)
  },
  evalSessionsPage: async ({ page }, fixtureUse) => {
    const evalSessionsPage = new EvalSessionsPage(page)
    await fixtureUse(evalSessionsPage)
  },
  evalSessionApplicationsPage: async ({ page }, fixtureUse) => {
    const evalSessionApplicationsPage = new EvalSessionApplicationsPage(page)
    await fixtureUse(evalSessionApplicationsPage)
  },
  evalEvaluationPage: async ({ page }, fixtureUse) => {
    const evalEvaluationPage = new EvalEvaluationPage(page)
    await fixtureUse(evalEvaluationPage)
  },
})

export { getOTPFromRedis, waitForOTP, clearRedisOTP, clearSubmissions } from './helpers'
