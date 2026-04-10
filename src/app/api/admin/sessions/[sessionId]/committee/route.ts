import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getAdminSession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'

const assignSchema = z
  .object({
    memberIds: z.array(z.string().min(1)).min(1, '배정할 위원을 선택해주세요'),
    chairId: z.string().min(1).optional(),
  })
  .refine(
    (data) => {
      if (!data.chairId) {
        return true
      }

      return data.memberIds.includes(data.chairId)
    },
    {
      message: '위원장은 배정 대상 중에서 선택해야 합니다',
      path: ['chairId'],
    },
  )

type SessionCommitteeContext = {
  params: Promise<{ sessionId: string }>
}

export async function GET(request: Request, context: SessionCommitteeContext) {
  const adminSession = await getAdminSession(request)

  if (!adminSession) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { sessionId } = await context.params

  const assignments = await prisma.sessionCommitteeAssignment.findMany({
    where: { sessionId },
    include: {
      committeeMember: true,
    },
    orderBy: [{ role: 'asc' }, { assignedAt: 'asc' }],
  })

  return NextResponse.json({ assignments }, { status: 200 })
}

export async function POST(request: Request, context: SessionCommitteeContext) {
  const adminSession = await getAdminSession(request)

  if (!adminSession) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { sessionId } = await context.params

  const session = await prisma.evaluationSession.findUnique({
    where: { id: sessionId },
    select: { id: true },
  })

  if (!session) {
    return NextResponse.json({ error: '평가 회차를 찾을 수 없습니다' }, { status: 404 })
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 })
  }

  const parsed = assignSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const uniqueMemberIds = Array.from(new Set(parsed.data.memberIds))

  const members = await prisma.committeeMember.findMany({
    where: {
      id: { in: uniqueMemberIds },
      isActive: true,
    },
    select: { id: true },
  })

  if (members.length !== uniqueMemberIds.length) {
    return NextResponse.json(
      { error: '활성 상태의 평가위원만 배정할 수 있습니다' },
      { status: 400 },
    )
  }

  await prisma.$transaction(
    uniqueMemberIds.map((memberId) =>
      prisma.sessionCommitteeAssignment.upsert({
        where: {
          sessionId_committeeMemberId: {
            sessionId,
            committeeMemberId: memberId,
          },
        },
        update: {
          role: parsed.data.chairId === memberId ? 'chair' : 'member',
        },
        create: {
          sessionId,
          committeeMemberId: memberId,
          role: parsed.data.chairId === memberId ? 'chair' : 'member',
        },
      }),
    ),
  )

  const assignments = await prisma.sessionCommitteeAssignment.findMany({
    where: { sessionId },
    include: {
      committeeMember: true,
    },
    orderBy: [{ role: 'asc' }, { assignedAt: 'asc' }],
  })

  try {
    await prisma.auditEvent.create({
      data: {
        actorType: 'admin',
        actorId: adminSession.id,
        action: 'create',
        targetType: 'SessionCommitteeAssignment',
        targetId: sessionId,
        sessionId,
        ipAddress:
          request.headers.get('x-forwarded-for') ??
          request.headers.get('x-real-ip') ??
          null,
        payloadJson: { memberIds: parsed.data.memberIds, chairId: parsed.data.chairId ?? null },
      },
    })
  } catch (e) {
    console.error('Audit log failed:', e)
  }

  return NextResponse.json({ assignments }, { status: 200 })
}
