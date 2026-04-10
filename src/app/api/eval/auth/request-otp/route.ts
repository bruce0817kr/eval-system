import { NextResponse } from 'next/server'
import { Pool } from 'pg'
import { z } from 'zod'

import { logAuditEvent as writeAuditEvent } from '@/lib/audit'
import { generateOtp, rateLimitOtp, storeOtpForOctomo } from '@/lib/auth/otp'

// Prisma WASM 컴파일러 버그로 인해 raw pg 사용
const pgPool = new Pool({ connectionString: process.env.DATABASE_URL })

const OCTOMO_TARGET_NUMBER = process.env.OCTOMO_TARGET_NUMBER ?? '1666-3538'

const requestOtpSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력해주세요'),
  phone: z
    .string()
    .trim()
    .regex(/^010-?\d{4}-?\d{4}$/, '휴대폰 번호 형식이 올바르지 않습니다'),
})

function normalizePhone(phone: string) {
  return phone.replace(/-/g, '')
}

function formatPhone(phone: string) {
  const normalized = normalizePhone(phone)
  return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7, 11)}`
}

function getClientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

function getRequestId(request: Request) {
  return request.headers.get('x-request-id') ?? null
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

  const parsed = requestOtpSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const { name, phone } = parsed.data
  const normalizedPhone = normalizePhone(phone)

  const allowed = await rateLimitOtp(normalizedPhone)

  if (!allowed) {
    return NextResponse.json(
      { error: '인증번호 요청이 너무 많습니다. 잠시 후 다시 시도해주세요' },
      { status: 429 },
    )
  }

  // Prisma WASM 버그 우회: raw pg 직접 사용 (name + phone SQL 파라미터로 전달)
  const { rows } = await pgPool.query<{ id: string; name: string; phone: string }>(
    'SELECT id, name, phone FROM committee_member WHERE name = $1 AND phone = ANY($2::text[]) LIMIT 1',
    [name, [normalizedPhone, formatPhone(normalizedPhone)]],
  )
  const member = rows[0] ?? null

  if (!member) {
    return NextResponse.json(
      { error: '등록된 평가위원이 아닙니다' },
      { status: 404 },
    )
  }

  const code = await generateOtp(normalizedPhone)
  await storeOtpForOctomo(normalizedPhone, code)

  await safeLogAuditEvent({
    actorType: 'committee_member',
    actorId: member.id,
    action: 'login',
    targetType: 'committee_member',
    targetId: member.id,
    requestId: getRequestId(request),
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('user-agent'),
    payloadJson: {
      stage: 'request_otp',
      phone: normalizedPhone,
    },
  })

  return NextResponse.json(
    {
      message: '인증번호가 생성되었습니다',
      code,
      targetNumber: OCTOMO_TARGET_NUMBER,
      instructions: `아래 인증번호를 ${OCTOMO_TARGET_NUMBER}로 전송해주세요.`,
    },
    { status: 200 },
  )
}
