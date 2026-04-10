import { execSync } from 'child_process'
import type { Page } from '@playwright/test'

export async function getOTPFromRedis(phone: string): Promise<string | null> {
  const normalized = phone.replace(/-/g, '')
  try {
    const result = execSync(
      `docker exec eval-redis-1 redis-cli -p 6379 GET "otp:${normalized}"`,
      { encoding: 'utf8' },
    )
    return result.trim() || null
  } catch {
    return null
  }
}

export async function getOTPFromOctomo(
  phone: string,
  code: string,
): Promise<boolean> {
  const apiKey = process.env.OCTOMO_API_KEY
  if (!apiKey) return false

  const normalized = phone.replace(/-/g, '')
  try {
    const response = await fetch(
      'https://api.octoverse.kr/octomo/v1/public/message/exists',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Octomo ${apiKey}`,
        },
        body: JSON.stringify({ mobileNum: normalized, text: code }),
      },
    )

    if (!response.ok) return false

    const result = (await response.json()) as { verified: boolean }
    return result.verified === true
  } catch {
    return false
  }
}

export async function waitForOTP(
  page: Page,
  phone: string,
  maxWaitMs = 30000,
): Promise<string | null> {
  const startTime = Date.now()
  while (Date.now() - startTime < maxWaitMs) {
    const otp = await getOTPFromRedis(phone)
    if (otp) return otp
    await page.waitForTimeout(500)
  }
  return null
}

export async function clearRedisOTP(phone: string): Promise<void> {
  const normalized = phone.replace(/-/g, '')
  try {
    execSync(
      `docker exec eval-redis-1 redis-cli -p 6379 DEL "otp:${normalized}" "otp:rate:${normalized}"`,
    )
  } catch {
    // Empty catch - cleanup failures are non-critical
  }
}

export async function clearAdminRateLimit(): Promise<void> {
  try {
    const keys = execSync(
      `docker exec eval-redis-1 redis-cli -p 6379 KEYS "admin:login:rate:*"`,
      { encoding: 'utf8' },
    ).trim()
    if (keys) {
      const keyList = keys.split('\n').join(' ')
      execSync(`docker exec eval-redis-1 redis-cli -p 6379 DEL ${keyList}`)
    }
  } catch {
    // cleanup failures are non-critical
  }
}

export function clearSubmissions(memberId: string, sessionId: string): void {
  try {
    execSync(
      `docker exec eval-postgres psql -U eval -d eval_db -c "DELETE FROM signature_artifact WHERE \\\"submissionId\\\" IN (SELECT id FROM evaluation_submission WHERE \\\"committeeMemberId\\\" = '${memberId}' AND \\\"sessionId\\\" = '${sessionId}')"`,
      { encoding: 'utf8' },
    )
    execSync(
      `docker exec eval-postgres psql -U eval -d eval_db -c "DELETE FROM evaluation_submission WHERE \\\"committeeMemberId\\\" = '${memberId}' AND \\\"sessionId\\\" = '${sessionId}'"`,
      { encoding: 'utf8' },
    )
  } catch {
    // cleanup failures are non-critical
  }
}
