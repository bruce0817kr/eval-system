type RedisLike = {
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<number>
  del(key: string): Promise<number>
}

type RedisModule = {
  default: new (
    url: string,
    options?: { lazyConnect?: boolean; maxRetriesPerRequest?: number | null },
  ) => RedisLike
}

let redisClient: RedisLike | null | undefined

async function getRedisClient(): Promise<RedisLike | null> {
  if (redisClient !== undefined) {
    return redisClient
  }

  const redisUrl = process.env.REDIS_URL

  if (!redisUrl) {
    redisClient = null
    return null
  }

  try {
    const dynamicImport = new Function(
      'specifier',
      'return import(specifier)',
    ) as (specifier: string) => Promise<unknown>
    const redisModule = await dynamicImport('ioredis')

    if (
      typeof redisModule === 'object' &&
      redisModule !== null &&
      'default' in redisModule &&
      typeof redisModule.default === 'function'
    ) {
      const Redis = (redisModule as RedisModule).default
      redisClient = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: null,
      })
      return redisClient
    }
  } catch {
    // ioredis not available
  }

  redisClient = null
  return null
}

const LOGIN_RATE_LIMIT_MAX = 10
const LOGIN_RATE_LIMIT_WINDOW = 60 * 15 // 15분

function getLoginRateLimitKey(identifier: string) {
  return `admin:login:rate:${identifier}`
}

// 인메모리 fallback (Redis 미설정/장애 시)
const inMemoryStore = new Map<string, { count: number; expiresAt: number }>()

function inMemoryRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const key = getLoginRateLimitKey(ip)

  // 주기적으로 만료 항목 정리
  if (inMemoryStore.size > 1000) {
    for (const [k, v] of inMemoryStore) {
      if (v.expiresAt < now) inMemoryStore.delete(k)
    }
  }

  const entry = inMemoryStore.get(key)
  if (!entry || entry.expiresAt < now) {
    inMemoryStore.set(key, { count: 1, expiresAt: now + LOGIN_RATE_LIMIT_WINDOW * 1000 })
    return { allowed: true, remaining: LOGIN_RATE_LIMIT_MAX - 1 }
  }

  entry.count += 1
  const remaining = Math.max(0, LOGIN_RATE_LIMIT_MAX - entry.count)
  return { allowed: entry.count <= LOGIN_RATE_LIMIT_MAX, remaining }
}

/**
 * 관리자 로그인 Rate Limiting (IP 기반)
 * @returns allowed: true = 허용, false = 차단
 */
export async function rateLimitAdminLogin(
  ip: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const key = getLoginRateLimitKey(ip)
  const redis = await getRedisClient()

  if (redis) {
    try {
      const attempts = await redis.incr(key)
      if (attempts === 1) {
        await redis.expire(key, LOGIN_RATE_LIMIT_WINDOW)
      }
      const remaining = Math.max(0, LOGIN_RATE_LIMIT_MAX - attempts)
      return { allowed: attempts <= LOGIN_RATE_LIMIT_MAX, remaining }
    } catch {
      // Redis 실패 시 인메모리 fallback
    }
  }

  return inMemoryRateLimit(ip)
}
