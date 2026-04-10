import { SignJWT } from 'jose'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { logAuditEvent as writeAuditEvent } from '@/lib/audit'
import { verifyPassword } from '@/lib/auth/password'
import { rateLimitAdminLogin } from '@/lib/auth/rate-limit'
import { prisma } from '@/lib/db'

const loginSchema = z.object({
  email: z.string().trim().email('유효한 이메일 주소를 입력해주세요'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
})

const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8

function getClientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

function getRequestId(request: Request) {
  return request.headers.get('x-request-id') ?? null
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET

  if (!secret) {
    throw new Error('AUTH_SECRET is not configured')
  }

  return new TextEncoder().encode(secret)
}

async function createAdminSessionToken(input: {
  sub: string
  email: string
  name: string
  role: 'admin' | 'operator' | 'auditor'
}) {
  return new SignJWT({
    email: input.email,
    name: input.name,
    role: input.role,
    type: 'admin',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.sub)
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_MAX_AGE}s`)
    .sign(getAuthSecret())
}

async function safeLogAuditEvent(input: {
  actorType: 'admin' | 'committee_member' | 'system'
  actorId: string
  action: 'login'
  targetType?: string
  targetId?: string
  requestId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  payloadJson?: Record<string, unknown>
}) {
  try {
    await writeAuditEvent({
      ...input,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      requestId: input.requestId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      payloadJson: input.payloadJson ?? null,
    })
  } catch {
  }
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: '요청 본문이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const { email, password } = parsed.data
  const requestId = getRequestId(request)
  const ipAddress = getClientIp(request)
  const userAgent = request.headers.get('user-agent')

  const rateLimit = await rateLimitAdminLogin(ipAddress ?? 'unknown')
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: '로그인 시도 횟수를 초과했습니다. 15분 후 다시 시도해주세요.' },
      { status: 429 },
    )
  }

  const user = await prisma.adminUser.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
    },
  })

  const isValid =
    user !== null && (await verifyPassword(password, user.passwordHash))

  if (!isValid || user === null) {
    await safeLogAuditEvent({
      actorType: 'system',
      actorId: 'unknown',
      action: 'login',
      targetType: 'admin_user',
      requestId,
      ipAddress,
      userAgent,
      payloadJson: {
        email,
        outcome: 'failure',
      },
    })

    return NextResponse.json(
      { error: '이메일 또는 비밀번호가 올바르지 않습니다' },
      { status: 401 },
    )
  }

  let token: string

  try {
    token = await createAdminSessionToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })
  } catch {
    return NextResponse.json(
      { error: '인증 설정이 올바르지 않습니다' },
      { status: 500 },
    )
  }

  await safeLogAuditEvent({
    actorType: 'admin',
    actorId: user.id,
    action: 'login',
    targetType: 'admin_user',
    targetId: user.id,
    requestId,
    ipAddress,
    userAgent,
    payloadJson: {
      email: user.email,
      outcome: 'success',
      role: user.role,
    },
  })

  const response = NextResponse.json(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    { status: 200 },
  )

  response.cookies.set({
    name: 'admin_session',
    value: token,
    httpOnly: true,
    secure: request.url.startsWith('https://'),
    sameSite: 'strict',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE,
  })

  return response
}
