import { SignJWT } from 'jose'
import { NextResponse } from 'next/server'
import { Pool } from 'pg'
import { z } from 'zod'

import { logAuditEvent as writeAuditEvent } from '@/lib/audit'
import { verifyOtp, verifyOtpViaOctomo } from '@/lib/auth/otp'

// Prisma WASM 컴파일러 버그로 인해 raw pg 사용
const pgPool = new Pool({ connectionString: process.env.DATABASE_URL })

const verifyOtpSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력해주세요'),
  phone: z
    .string()
    .trim()
    .regex(/^010-?\d{4}-?\d{4}$/, '휴대폰 번호 형식이 올바르지 않습니다'),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, '인증번호 형식이 올바르지 않습니다'),
})

const COMMITTEE_SESSION_MAX_AGE = 60 * 60 * 4

function normalizePhone(phone: string) {
  return phone.replace(/-/g, '')
}

function formatPhone(phone: string) {
  const normalized = normalizePhone(phone)
  return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7, 11)}`
}

function getClientIp(request: Request) {
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const parts = forwarded.split(',')
    return parts[parts.length - 1]?.trim() ?? null
  }
  return null
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

async function createCommitteeSessionToken(input: {
  sub: string
  name: string
  phone: string
}) {
  return new SignJWT({
    name: input.name,
    phone: input.phone,
    type: 'committee',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.sub)
    .setIssuedAt()
    .setExpirationTime(`${COMMITTEE_SESSION_MAX_AGE}s`)
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

  const parsed = verifyOtpSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const { name, phone, code } = parsed.data
  const normalizedPhone = normalizePhone(phone)
  const requestId = getRequestId(request)
  const ipAddress = getClientIp(request)
  const userAgent = request.headers.get('user-agent')

  // Prisma WASM 버그 우회: raw pg 직접 사용 (name + phone SQL 파라미터로 전달)
  const { rows } = await pgPool.query<{ id: string; name: string; phone: string }>(
    'SELECT id, name, phone FROM committee_member WHERE name = $1 AND phone = ANY($2::text[]) AND is_active = TRUE LIMIT 1',
    [name, [normalizedPhone, formatPhone(normalizedPhone)]],
  )
  const member = rows[0] ?? null

  let isValid = false
  if (member) {
    const octomoResult = await verifyOtpViaOctomo(normalizedPhone, code)
    const localResult = await verifyOtp(normalizedPhone, code)
    isValid = octomoResult || localResult
  }

  if (!isValid || member === null) {
    await safeLogAuditEvent({
      actorType: 'system',
      actorId: 'unknown',
      action: 'login',
      targetType: 'committee_member',
      requestId,
      ipAddress,
      userAgent,
      payloadJson: {
        name,
        phone: normalizedPhone,
        outcome: 'failure',
      },
    })

    return NextResponse.json(
      { error: '인증번호가 올바르지 않습니다' },
      { status: 401 },
    )
  }

  let token: string

  try {
    token = await createCommitteeSessionToken({
      sub: member.id,
      name: member.name,
      phone: member.phone,
    })
  } catch {
    return NextResponse.json(
      { error: '인증 설정이 올바르지 않습니다' },
      { status: 500 },
    )
  }

  await safeLogAuditEvent({
    actorType: 'committee_member',
    actorId: member.id,
    action: 'login',
    targetType: 'committee_member',
    targetId: member.id,
    requestId,
    ipAddress,
    userAgent,
    payloadJson: {
      phone: member.phone,
      outcome: 'success',
    },
  })

  const response = NextResponse.json(
    {
      id: member.id,
      name: member.name,
      phone: member.phone,
      type: 'committee',
    },
    { status: 200 },
  )

  response.cookies.set({
    name: 'eval_session',
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || request.headers.get('x-forwarded-proto') === 'https',
    sameSite: 'strict',
    path: '/',
    maxAge: COMMITTEE_SESSION_MAX_AGE,
  })

  return response
}
