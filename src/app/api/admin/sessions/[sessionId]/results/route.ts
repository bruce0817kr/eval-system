import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAdminSession } from '@/lib/auth/jwt'
import { EvaluationSession } from '@/generated/prisma/client'

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
      include: {
        applications: {
          include: {
            company: true,
            resultSnapshots: {
              orderBy: {
                rank: 'asc'
              }
            }
          }
        }
      }
    })

    if (!evalSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const results = evalSession.applications.map(app => {
      const snapshot = app.resultSnapshots[0]
      return {
        순위: snapshot?.rank || null,
        기업명: app.company.name,
        사업자번호: app.company.businessNumber || '',
        대표자명: app.company.ceoName || '',
        최종점수: snapshot?.finalScore || null,
        신청순서: app.evaluationOrder,
        상태: app.status
      }
    })

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'excel'

    if (format === 'pdf') {
      return NextResponse.json({
        message: 'PDF generation endpoint - implement with pdfkit/puppeteer in production',
        data: results
      })
    } else {
      return NextResponse.json({
        success: true,
        sessionId: resolvedParams.sessionId,
        sessionTitle: evalSession.title,
        generatedAt: new Date().toISOString(),
        results: results,
        totalApplications: evalSession.applications.length,
        evaluatedApplications: results.filter(r => r.최종점수 !== null).length
      })
    }
  } catch (error) {
    console.error('Results export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}