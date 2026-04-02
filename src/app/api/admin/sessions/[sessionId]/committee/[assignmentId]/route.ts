import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getAdminSession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'

const updateRoleSchema = z.object({
  role: z.enum(['chair', 'member'], {
    error: '역할은 chair 또는 member만 가능합니다',
  }),
})

type SessionAssignmentContext = {
  params: Promise<{ sessionId: string; assignmentId: string }>
}

export async function DELETE(request: Request, context: SessionAssignmentContext) {
  const adminSession = await getAdminSession(request)

  if (!adminSession) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { sessionId, assignmentId } = await context.params

  const existingAssignment = await prisma.sessionCommitteeAssignment.findFirst({
    where: {
      id: assignmentId,
      sessionId,
    },
    select: { id: true },
  })

  if (!existingAssignment) {
    return NextResponse.json({ error: '배정 정보를 찾을 수 없습니다' }, { status: 404 })
  }

  await prisma.sessionCommitteeAssignment.delete({
    where: { id: assignmentId },
  })

  return NextResponse.json({ success: true }, { status: 200 })
}

export async function PATCH(request: Request, context: SessionAssignmentContext) {
  const adminSession = await getAdminSession(request)

  if (!adminSession) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { sessionId, assignmentId } = await context.params

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 })
  }

  const parsed = updateRoleSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const assignment = await prisma.sessionCommitteeAssignment.findFirst({
    where: {
      id: assignmentId,
      sessionId,
    },
    select: {
      id: true,
    },
  })

  if (!assignment) {
    return NextResponse.json({ error: '배정 정보를 찾을 수 없습니다' }, { status: 404 })
  }

  const updated =
    parsed.data.role === 'chair'
      ? await prisma.$transaction(async (tx) => {
          await tx.sessionCommitteeAssignment.updateMany({
            where: {
              sessionId,
              role: 'chair',
            },
            data: {
              role: 'member',
            },
          })

          return tx.sessionCommitteeAssignment.update({
            where: { id: assignmentId },
            data: { role: 'chair' },
          })
        })
      : await prisma.sessionCommitteeAssignment.update({
          where: { id: assignmentId },
          data: { role: 'member' },
        })

  return NextResponse.json(updated, { status: 200 })
}
