import { NextResponse } from 'next/server'

import { getAdminSession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const admin = await getAdminSession(request)
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { sessionId } = await params
  const { searchParams } = new URL(request.url)
  const memberId = searchParams.get('memberId') ?? undefined
  const take = Math.max(
    1,
    Math.min(parseInt(searchParams.get('take') ?? '500', 10) || 500, 1000),
  )

  const submissions = await prisma.evaluationSubmission.findMany({
    where: {
      sessionId,
      ...(memberId ? { committeeMemberId: memberId } : {}),
    },
    take,
    include: {
      application: {
        include: {
          company: { select: { name: true } },
        },
      },
      committeeMember: { select: { id: true, name: true } },
      signatureArtifact: {
        select: { id: true, signedAt: true, otpVerified: true },
      },
    },
    orderBy: [
      { application: { evaluationOrder: 'asc' } },
      { createdAt: 'asc' },
    ],
  })

  return NextResponse.json({ submissions })
}
