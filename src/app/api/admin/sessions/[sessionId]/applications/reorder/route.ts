import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getAdminSession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'

const reorderSchema = z.object({
  orderedIds: z.array(z.string().trim().min(1)).min(1),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const admin = await getAdminSession(request)

  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { sessionId } = await params
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 })
  }

  const parsed = reorderSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다' }, { status: 400 })
  }

  const existing = await prisma.application.findMany({
    where: {
      sessionId,
      id: { in: parsed.data.orderedIds },
    },
    select: { id: true },
  })

  if (existing.length !== parsed.data.orderedIds.length) {
    return NextResponse.json(
      { error: '세션에 속하지 않은 신청 ID가 포함되어 있습니다' },
      { status: 400 },
    )
  }

  await prisma.$transaction(
    parsed.data.orderedIds.map((applicationId, index) =>
      prisma.application.update({
        where: { id: applicationId },
        data: { evaluationOrder: index + 1 },
      }),
    ),
  )

  return NextResponse.json({ ok: true })
}
