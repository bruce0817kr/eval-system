import { NextResponse } from 'next/server'

import { verifySession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'

async function getEvaluatorId(request: Request) {
  const payload =
    (await verifySession('eval_session', request)) ??
    (await verifySession('committee_session', request))

  if (!payload?.sub || typeof payload.sub !== 'string') {
    return null
  }

  return payload.sub
}

export async function GET(request: Request) {
  try {
    const committeeMemberId = await getEvaluatorId(request)

    if (!committeeMemberId) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const member = await prisma.committeeMember.findUnique({
      where: { id: committeeMemberId },
      select: {
        id: true,
        name: true,
        phone: true,
        organization: true,
        position: true,
        isActive: true,
      },
    })

    if (!member || !member.isActive) {
      return NextResponse.json({ error: '평가위원 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    return NextResponse.json(
      {
        id: member.id,
        name: member.name,
        phone: member.phone,
        organization: member.organization,
        position: member.position,
      },
      { status: 200 },
    )
  } catch {
    return NextResponse.json({ error: '평가위원 정보를 불러오지 못했습니다' }, { status: 500 })
  }
}
