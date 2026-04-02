import { NextResponse } from 'next/server'
import { z } from 'zod'

import { logAuditEvent as writeAuditEvent } from '@/lib/audit'
import { generateOtp, rateLimitOtp } from '@/lib/auth/otp'
import { prisma } from '@/lib/db'

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

  const member = await prisma.committeeMember.findFirst({
    where: {
      name,
      phone: {
        in: [normalizedPhone, formatPhone(normalizedPhone)],
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
    },
  })

  if (!member) {
    return NextResponse.json(
      { error: '등록된 평가위원이 아닙니다' },
      { status: 404 },
    )
  }

  await generateOtp(normalizedPhone)
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
    { message: '인증번호가 전송되었습니다' },
    { status: 200 },
  )
}
