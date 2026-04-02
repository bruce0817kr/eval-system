import { NextResponse } from 'next/server'
import { z } from 'zod'

import { logAuditEvent as writeAuditEvent } from '@/lib/audit'
import { hashPassword } from '@/lib/auth/password'
import { prisma } from '@/lib/db'

const registerSchema = z.object({
  email: z.string().trim().email('유효한 이메일 주소를 입력해주세요'),
  password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다'),
  name: z.string().trim().min(1, '이름을 입력해주세요'),
  role: z.enum(['admin', 'operator', 'auditor'], {
    error: '유효한 역할을 선택해주세요',
  }),
})

function getClientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

function getRequestId(request: Request) {
  return request.headers.get('x-request-id') ?? null
}

async function safeLogAuditEvent(input: {
  actorType: 'admin' | 'committee_member' | 'system'
  actorId: string
  action: 'login' | 'logout' | 'create'
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

  const parsed = registerSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const { email, password, name, role } = parsed.data

  const existingUser = await prisma.adminUser.findUnique({
    where: { email },
    select: { id: true },
  })

  if (existingUser) {
    return NextResponse.json(
      { error: '이미 등록된 이메일입니다' },
      { status: 409 },
    )
  }

  const passwordHash = await hashPassword(password)
  const user = await prisma.adminUser.create({
    data: {
      email,
      passwordHash,
      name,
      role,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  })

  await safeLogAuditEvent({
    actorType: 'admin',
    actorId: user.id,
    action: 'create',
    targetType: 'admin_user',
    targetId: user.id,
    requestId: getRequestId(request),
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('user-agent'),
    payloadJson: {
      email: user.email,
      role: user.role,
    },
  })

  return NextResponse.json(user, { status: 201 })
}
