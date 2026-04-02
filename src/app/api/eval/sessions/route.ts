import { SubmissionState } from '@/generated/prisma/client'
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

    const assignments = await prisma.sessionCommitteeAssignment.findMany({
      where: {
        committeeMemberId,
      },
      select: {
        sessionId: true,
        role: true,
        session: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
          },
        },
      },
      orderBy: {
        assignedAt: 'desc',
      },
    })

    const sessionIds = assignments.map((assignment) => assignment.sessionId)

    if (!sessionIds.length) {
      return NextResponse.json([], { status: 200 })
    }

    const [applicationCounts, completedCounts] = await Promise.all([
      prisma.application.groupBy({
        by: ['sessionId'],
        where: {
          sessionId: {
            in: sessionIds,
          },
        },
        _count: {
          _all: true,
        },
      }),
      prisma.evaluationSubmission.groupBy({
        by: ['sessionId'],
        where: {
          sessionId: {
            in: sessionIds,
          },
          committeeMemberId,
          submissionState: {
            in: [SubmissionState.submitted, SubmissionState.signed],
          },
        },
        _count: {
          _all: true,
        },
      }),
    ])

    const applicationsMap = new Map(
      applicationCounts.map((entry) => [entry.sessionId, entry._count._all]),
    )
    const completedMap = new Map(
      completedCounts.map((entry) => [entry.sessionId, entry._count._all]),
    )

    const result = assignments.map((assignment) => {
      const totalApplications = applicationsMap.get(assignment.sessionId) ?? 0
      const completedByMe = completedMap.get(assignment.sessionId) ?? 0

      return {
        session: assignment.session,
        role: assignment.role,
        totalApplications,
        submissionsByMe: completedByMe,
        totalSubmissionsNeeded: totalApplications,
      }
    })

    return NextResponse.json(result, { status: 200 })
  } catch {
    return NextResponse.json({ error: '세션 목록을 불러오지 못했습니다' }, { status: 500 })
  }
}
