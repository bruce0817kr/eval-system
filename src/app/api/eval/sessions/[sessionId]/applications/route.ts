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

    if (!assignment) {
      return NextResponse.json({ error: '배정되지 않은 세션입니다' }, { status: 403 })
    }

    const applications = await prisma.application.findMany({
      where: {
        sessionId,
      },
      orderBy: [{ evaluationOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        evaluationDrafts: {
          where: {
            committeeMemberId,
          },
          select: {
            id: true,
            version: true,
            lastSavedAt: true,
          },
          take: 1,
        },
        evaluationSubmissions: {
          where: {
            committeeMemberId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            submissionState: true,
            signedAt: true,
            submittedAt: true,
          },
          take: 1,
        },
      },
    })

    const items = applications.map((application) => {
      const draft = application.evaluationDrafts[0] ?? null
      const submission = application.evaluationSubmissions[0] ?? null

      const evaluatorState = submission
        ? submission.submissionState
        : draft
          ? 'draft'
          : 'not_started'

      return {
        id: application.id,
        evaluationOrder: application.evaluationOrder,
        status: application.status,
        company: application.company,
        evaluatorState,
        hasDraft: Boolean(draft),
        hasSubmission: Boolean(submission),
        draft,
        submission,
      }
    })

    return NextResponse.json(
      {
        items,
        total: items.length,
      },
      { status: 200 },
    )
  } catch {
    return NextResponse.json({ error: '신청 목록을 불러오지 못했습니다' }, { status: 500 })
  }
}
