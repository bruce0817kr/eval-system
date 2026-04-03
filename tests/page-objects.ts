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

export const test = base.extend<{ evalLoginPage: EvalLoginPage }>({
  evalLoginPage: async ({ page }, use) => {
    const evalLoginPage = new EvalLoginPage(page)
    await use(evalLoginPage)
  },
})

export { getOTPFromRedis, waitForOTP, clearRedisOTP } from './helpers'
