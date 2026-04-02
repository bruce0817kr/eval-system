import { type Prisma } from '@/generated/prisma/client'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { verifySession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'

const putDraftSchema = z.object({
  applicationId: z.string().trim().min(1),
  answersJson: z.record(z.string(), z.unknown()),
  version: z.number().int().min(0),
})

async function getEvaluatorId(request: Request) {
  const payload =
    (await verifySession('eval_session', request)) ??
    (await verifySession('committee_session', request))

  if (!payload?.sub || typeof payload.sub !== 'string') {
    return null
  }

  return payload.sub
}

async function isAssigned(sessionId: string, committeeMemberId: string) {
  const assignment = await prisma.sessionCommitteeAssignment.findUnique({
    where: {
      sessionId_committeeMemberId: {
        sessionId,
        committeeMemberId,
      },
    },
    select: {
      id: true,
    },
  })

  return Boolean(assignment)
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const committeeMemberId = await getEvaluatorId(request)

    if (!committeeMemberId) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { sessionId } = await params

    if (!(await isAssigned(sessionId, committeeMemberId))) {
      return NextResponse.json({ error: '배정되지 않은 세션입니다' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const applicationId = searchParams.get('applicationId')

    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId가 필요합니다' }, { status: 400 })
    }

    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        sessionId,
      },
      select: {
        id: true,
      },
    })

    if (!application) {
      return NextResponse.json({ error: '신청 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    const draft = await prisma.evaluationDraft.findUnique({
      where: {
        applicationId_committeeMemberId: {
          applicationId,
          committeeMemberId,
        },
      },
    })

    return NextResponse.json({ draft }, { status: 200 })
  } catch {
    return NextResponse.json({ error: '초안을 불러오지 못했습니다' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const committeeMemberId = await getEvaluatorId(request)

    if (!committeeMemberId) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { sessionId } = await params

    if (!(await isAssigned(sessionId, committeeMemberId))) {
      return NextResponse.json({ error: '배정되지 않은 세션입니다' }, { status: 403 })
    }

    let body: unknown

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 })
    }

    const parsed = putDraftSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
        { status: 400 },
      )
    }

    const { applicationId, answersJson, version } = parsed.data

    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        sessionId,
      },
      select: {
        id: true,
      },
    })

    if (!application) {
      return NextResponse.json({ error: '신청 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    const existing = await prisma.evaluationDraft.findUnique({
      where: {
        applicationId_committeeMemberId: {
          applicationId,
          committeeMemberId,
        },
      },
    })

    if (!existing) {
      const created = await prisma.evaluationDraft.create({
        data: {
          applicationId,
          committeeMemberId,
          sessionId,
          answersJson: answersJson as Prisma.InputJsonValue,
          version: 1,
          lastSavedAt: new Date(),
        },
      })

      return NextResponse.json({ draft: created }, { status: 200 })
    }

    if (existing.version !== version) {
      return NextResponse.json(
        {
          error: '버전 충돌이 발생했습니다. 최신 초안을 다시 불러와 주세요.',
          conflict: {
            currentVersion: existing.version,
            draft: existing,
          },
        },
        { status: 409 },
      )
    }

    const updated = await prisma.evaluationDraft.update({
      where: {
        id: existing.id,
      },
      data: {
        answersJson: answersJson as Prisma.InputJsonValue,
        version: existing.version + 1,
        lastSavedAt: new Date(),
      },
    })

    return NextResponse.json({ draft: updated }, { status: 200 })
  } catch {
    return NextResponse.json({ error: '초안 저장에 실패했습니다' }, { status: 500 })
  }
}
