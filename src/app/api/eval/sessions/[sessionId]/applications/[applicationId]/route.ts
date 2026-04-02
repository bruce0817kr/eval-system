import { NextResponse } from 'next/server'

import { verifySession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'
import { getFileUrl } from '@/lib/storage'

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
  {
    params,
  }: { params: Promise<{ sessionId: string; applicationId: string }> },
) {
  try {
    const committeeMemberId = await getEvaluatorId(request)

    if (!committeeMemberId) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { sessionId, applicationId } = await params

    const assignment = await prisma.sessionCommitteeAssignment.findUnique({
      where: {
        sessionId_committeeMemberId: {
          sessionId,
          committeeMemberId,
        },
      },
      select: { id: true },
    })

    if (!assignment) {
      return NextResponse.json({ error: '배정되지 않은 세션입니다' }, { status: 403 })
    }

    const [application, formDefinition, draft, submission] = await Promise.all([
      prisma.application.findFirst({
        where: {
          id: applicationId,
          sessionId,
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
            },
          },
          documents: {
            orderBy: {
              uploadedAt: 'asc',
            },
            select: {
              id: true,
              docType: true,
              storageKey: true,
              originalFilename: true,
              mimeType: true,
            },
          },
        },
      }),
      prisma.sessionFormDefinition.findUnique({
        where: { sessionId },
        select: {
          id: true,
          schemaJson: true,
          totalScore: true,
          itemsCount: true,
        },
      }),
      prisma.evaluationDraft.findUnique({
        where: {
          applicationId_committeeMemberId: {
            applicationId,
            committeeMemberId,
          },
        },
      }),
      prisma.evaluationSubmission.findFirst({
        where: {
          applicationId,
          committeeMemberId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ])

    if (!application) {
      return NextResponse.json({ error: '신청 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    if (!formDefinition) {
      return NextResponse.json({ error: '세션 평가표가 설정되지 않았습니다' }, { status: 409 })
    }

    const documents = await Promise.all(
      application.documents.map(async (document) => {
        let url: string | null = null

        try {
          url = await getFileUrl(document.storageKey)
        } catch {
          url = null
        }

        return {
          id: document.id,
          docType: document.docType,
          originalFilename: document.originalFilename,
          mimeType: document.mimeType,
          storageKey: document.storageKey,
          url,
        }
      }),
    )

    return NextResponse.json(
      {
        application: {
          id: application.id,
          evaluationOrder: application.evaluationOrder,
          status: application.status,
          company: application.company,
          documents,
        },
        formDefinition,
        draft,
        submission,
      },
      { status: 200 },
    )
  } catch {
    return NextResponse.json({ error: '평가 정보를 불러오지 못했습니다' }, { status: 500 })
  }
}
