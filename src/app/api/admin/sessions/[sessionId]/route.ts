import { NextResponse } from 'next/server'
import { z } from 'zod'

import { verifySession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'

const patchSessionSchema = z
  .object({
    title: z.string().trim().min(1, '회차명을 입력해주세요').optional(),
    description: z.string().trim().optional(),
    committeeSize: z
      .number({ error: '위원 수는 숫자여야 합니다' })
      .int('위원 수는 정수여야 합니다')
      .min(1, '위원 수는 1명 이상이어야 합니다')
      .max(50, '위원 수는 50명 이하여야 합니다')
      .optional(),
    trimRule: z.string().trim().min(1, '절사 규칙을 입력해주세요').optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.committeeSize !== undefined ||
      value.trimRule !== undefined,
    { message: '수정할 항목을 하나 이상 입력해주세요' },
  )

function unauthorized() {
  return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
}

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const adminSession = await verifySession('admin_session', request)

  if (!adminSession) {
    return unauthorized()
  }

  const { sessionId } = await context.params
  const session = await prisma.evaluationSession.findUnique({
    where: { id: sessionId },
    include: {
      formDefinition: true,
      applications: {
        include: {
          company: true,
        },
        orderBy: [{ evaluationOrder: 'asc' }, { createdAt: 'asc' }],
      },
      committeeMembers: {
        include: {
          committeeMember: true,
        },
        orderBy: { assignedAt: 'asc' },
      },
      resultSnapshots: {
        orderBy: { rank: 'asc' },
      },
      _count: {
        select: {
          applications: true,
          committeeMembers: true,
        },
      },
    },
  })

  if (!session) {
    return NextResponse.json(
      { error: '평가 회차를 찾을 수 없습니다' },
      { status: 404 },
    )
  }

  return NextResponse.json(session, { status: 200 })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const adminSession = await verifySession('admin_session', request)

  if (!adminSession) {
    return unauthorized()
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: '요청 본문이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const parsed = patchSessionSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const { sessionId } = await context.params
  const existing = await prisma.evaluationSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true },
  })

  if (!existing) {
    return NextResponse.json(
      { error: '평가 회차를 찾을 수 없습니다' },
      { status: 404 },
    )
  }

  if (existing.status !== 'draft') {
    return NextResponse.json(
      { error: '초안 상태에서만 기본 정보를 수정할 수 있습니다' },
      { status: 409 },
    )
  }

  const updated = await prisma.evaluationSession.update({
    where: { id: sessionId },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description || null }
        : {}),
      ...(parsed.data.committeeSize !== undefined
        ? { committeeSize: parsed.data.committeeSize }
        : {}),
      ...(parsed.data.trimRule !== undefined
        ? { trimRule: parsed.data.trimRule }
        : {}),
    },
  })

  return NextResponse.json(updated, { status: 200 })
}
