import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_session')?.value
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [
      totalSessions,
      openSessions,
      closedSessions,
      draftSessions,
      totalApplications,
      totalCommitteeMembers,
      recentSessions
    ] = await Promise.all([
      prisma.evaluationSession.count(),
      prisma.evaluationSession.count({ where: { status: 'open' } }),
      prisma.evaluationSession.count({ where: { status: 'closed' } }),
      prisma.evaluationSession.count({ where: { status: 'draft' } }),
      prisma.application.count(),
      prisma.committeeMember.count({ where: { isActive: true } }),
      prisma.evaluationSession.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          _count: {
            select: {
              applications: true,
              committeeMembers: true
            }
          }
        }
      })
    ])

    const sessionsWithProgress = await Promise.all(
      recentSessions.map(async (session) => {
        const submissions = await prisma.evaluationSubmission.count({
          where: {
            sessionId: session.id,
            submissionState: 'signed'
          }
        })
        
        const committeeCount = session._count.committeeMembers
        const applicationsCount = session._count.applications
        const totalPossibleSubmissions = applicationsCount * committeeCount
        const progress = totalPossibleSubmissions > 0 
          ? Math.round((submissions / totalPossibleSubmissions) * 100) 
          : 0

        return {
          id: session.id,
          title: session.title,
          status: session.status,
          openedAt: session.openedAt,
          closedAt: session.closedAt,
          applicationsCount,
          committeeCount,
          submissionsCount: submissions,
          progress
        }
      })
    )

    return NextResponse.json({
      stats: {
        totalSessions,
        openSessions,
        closedSessions,
        draftSessions,
        totalApplications,
        totalCommitteeMembers
      },
      recentSessions: sessionsWithProgress
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}
