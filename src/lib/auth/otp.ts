const OTP_TTL_SECONDS = 60 * 3
const OTP_RATE_LIMIT_WINDOW_SECONDS = 60 * 10
const OTP_RATE_LIMIT_MAX_REQUESTS = 5

type RedisLike = {
  get(key: string): Promise<string | null>
  set(key: string, value: string, mode?: "EX", duration?: number): Promise<unknown>
  del(key: string): Promise<number>
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<number>
}

type RedisConstructor = new (
  url: string,
  options?: {
    lazyConnect?: boolean
    maxRetriesPerRequest?: number | null
  }
) => RedisLike

type RedisModule = {
  default: RedisConstructor
}

type MemoryOtpEntry = {
  code: string
  expiresAt: number
}

const otpStore = new Map<string, MemoryOtpEntry>()
const rateLimitStore = new Map<string, number[]>()

let redisClient: RedisLike | null | undefined

async function loadRedisModule(): Promise<RedisModule | null> {
  try {
    const dynamicImport = new Function(
      "specifier",
      'return import(specifier)'
    ) as (specifier: string) => Promise<unknown>
    const module = await dynamicImport("ioredis")

    if (
      typeof module === "object" &&
      module !== null &&
      "default" in module &&
      typeof module.default === "function"
    ) {
      return module as RedisModule
    }

    return null
  } catch {
    return null
  }
}

function getOtpKey(phone: string): string {
  return `otp:${phone}`
}

function getRateLimitKey(phone: string): string {
  return `otp:rate:${phone}`
}

async function getRedisClient(): Promise<RedisLike | null> {
  if (redisClient !== undefined) {
    return redisClient
  }

  const redisUrl = process.env.REDIS_URL

  if (!redisUrl) {
    redisClient = null
    return redisClient
  }

  try {
    const redisModule = await loadRedisModule()

    if (!redisModule) {
      redisClient = null
      return redisClient
    }

    redisClient = new redisModule.default(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    })
  } catch {
    redisClient = null
  }

  return redisClient
}

function pruneRateLimitEntries(phone: string, now: number): number[] {
  const entries = rateLimitStore.get(phone) ?? []
  const threshold = now - OTP_RATE_LIMIT_WINDOW_SECONDS * 1000
  const nextEntries = entries.filter((timestamp) => timestamp > threshold)

  rateLimitStore.set(phone, nextEntries)

  return nextEntries
}

function getMemoryOtp(phone: string): MemoryOtpEntry | null {
  const entry = otpStore.get(phone)

  if (!entry) {
    return null
  }

  if (entry.expiresAt <= Date.now()) {
    otpStore.delete(phone)
    return null
  }

  return entry
}

export async function generateOtp(phone: string): Promise<string> {
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const redis = await getRedisClient()

  if (redis) {
    try {
      await redis.set(getOtpKey(phone), code, "EX", OTP_TTL_SECONDS)
      return code
    } catch {
      redisClient = null
    }
  }

  otpStore.set(phone, {
    code,
    expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
  })

  return code
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const redis = await getRedisClient()

  if (redis) {
    try {
      const storedCode = await redis.get(getOtpKey(phone))

      if (!storedCode || storedCode !== code) {
        return false
      }

      await redis.del(getOtpKey(phone))
      return true
    } catch {
      redisClient = null
    }
  }

  const entry = getMemoryOtp(phone)

  if (!entry || entry.code !== code) {
    return false
  }

  otpStore.delete(phone)
  return true
}

export async function rateLimitOtp(phone: string): Promise<boolean> {
  const redis = await getRedisClient()

  if (redis) {
    try {
      const key = getRateLimitKey(phone)
      const attempts = await redis.incr(key)

      if (attempts === 1) {
        await redis.expire(key, OTP_RATE_LIMIT_WINDOW_SECONDS)
      }

      return attempts <= OTP_RATE_LIMIT_MAX_REQUESTS
    } catch {
      redisClient = null
    }
  }

  const now = Date.now()
  const entries = pruneRateLimitEntries(phone, now)

  if (entries.length >= OTP_RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  rateLimitStore.set(phone, [...entries, now])
  return true
}

const OCTOMO_API_URL = 'https://api.octoverse.kr/octomo/v1/public/message/exists'
const OCTOMO_TTL_SECONDS = 60 * 5

export async function verifyOtpViaOctomo(
  phone: string,
  code: string,
): Promise<boolean> {
  const apiKey = process.env.OCTOMO_API_KEY

  if (!apiKey) {
    console.error('OCTOMO_API_KEY is not configured')
    return false
  }

  const normalizedPhone = phone.replace(/-/g, '')

  try {
    const response = await fetch(OCTOMO_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Octomo ${apiKey}`,
      },
      body: JSON.stringify({
        mobileNum: normalizedPhone,
        text: code,
      }),
    })

    if (!response.ok) {
      console.error('OCTOMO API error:', response.status, await response.text())
      return false
    }

    const result = (await response.json()) as { verified: boolean }

    return result.verified === true
  } catch (error) {
    console.error('OCTOMO API call failed:', error)
    return false
  }
}

export async function storeOtpForOctomo(
  phone: string,
  code: string,
): Promise<void> {
  const redis = await getRedisClient()
  const normalizedPhone = phone.replace(/-/g, '')

  if (redis) {
    try {
      await redis.set(
        getOtpKey(normalizedPhone),
        code,
        'EX',
        OCTOMO_TTL_SECONDS,
      )
      return
    } catch {
      redisClient = null
    }
  }

  otpStore.set(normalizedPhone, {
    code,
    expiresAt: Date.now() + OCTOMO_TTL_SECONDS * 1000,
  })
}
