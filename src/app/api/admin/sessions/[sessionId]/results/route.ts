import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAdminSession } from '@/lib/auth/jwt'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const resolvedParams = await params
    const session = await getAdminSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const evalSession = await prisma.evaluationSession.findUnique({
      where: { id: resolvedParams.sessionId },
      select: {
        title: true,
        status: true,
        applications: {
          include: {
            company: { select: { name: true } },
            resultSnapshots: {
              orderBy: { rank: 'asc' },
              take: 1,
            },
          },
        },
      },
    })

    if (!evalSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const results = evalSession.applications.map(app => {
      const snapshot = app.resultSnapshots[0]
      return {
        applicationId: app.id,
        companyName: app.company.name,
        rank: snapshot?.rank ?? null,
        finalScore: snapshot?.finalScore ?? null,
        status: app.status,
      }
    })

    // 순위 기준으로 정렬, 미집계는 하단
    results.sort((a, b) => {
      if (a.rank === null && b.rank === null) return 0
      if (a.rank === null) return 1
      if (b.rank === null) return -1
      return a.rank - b.rank
    })

    return NextResponse.json({
      success: true,
      sessionId: resolvedParams.sessionId,
      sessionTitle: evalSession.title,
      sessionStatus: evalSession.status,
      generatedAt: new Date().toISOString(),
      results,
      totalApplications: evalSession.applications.length,
      evaluatedApplications: results.filter(r => r.finalScore !== null).length,
    })
  } catch (error) {
    console.error('Results fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
