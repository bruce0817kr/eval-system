import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import {
  integrationError,
  integrationUnauthorized,
  verifyIntegrationRequest,
} from '@/lib/integration/auth'

type RouteContext = {
  params: Promise<{ externalSessionId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  if (!verifyIntegrationRequest(request)) {
    return integrationUnauthorized()
  }

  const { externalSessionId } = await context.params
  const session = await prisma.evaluationSession.findUnique({
    where: { id: externalSessionId },
    include: {
      applications: {
        include: {
          company: true,
          resultSnapshots: {
            orderBy: { computedAt: 'desc' },
            take: 1,
          },
          evaluationSubmissions: {
            where: {
              submissionState: 'signed',
              isValid: true,
            },
            select: { id: true },
          },
        },
        orderBy: [{ evaluationOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
  })

  if (!session) {
    return integrationError('SESSION_NOT_FOUND', 'Integration session not found', 404)
  }

  const results = session.applications
    .map((application) => {
      const snapshot = application.resultSnapshots[0] ?? null
      return {
        externalApplicationId: application.id,
        externalCompanyId: application.company.id,
        companyName: application.company.name,
        rank: snapshot?.rank ?? null,
        finalScore: snapshot?.finalScore ?? null,
        selected: typeof snapshot?.rank === 'number' ? snapshot.rank <= 3 : false,
        signedSubmissionCount: application.evaluationSubmissions.length,
        status: application.status,
      }
    })
    .sort((a, b) => {
      if (a.rank === null && b.rank === null) return 0
      if (a.rank === null) return 1
      if (b.rank === null) return -1
      return a.rank - b.rank
    })

  return NextResponse.json({
    externalSessionId: session.id,
    title: session.title,
    status: session.status,
    generatedAt: new Date().toISOString(),
    totalApplications: session.applications.length,
    evaluatedApplications: results.filter((result) => result.finalScore !== null).length,
    results,
  })
}
