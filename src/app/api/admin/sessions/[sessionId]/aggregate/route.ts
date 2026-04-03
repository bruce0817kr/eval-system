import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAdminSession, requireRole } from '@/lib/auth/jwt'
import { audit } from '@/lib/audit'
import { EvaluationSession, SessionStatus } from '@/generated/prisma/client'
import type { FormSchema, FormSection, FormItem } from '@/lib/form-template-schema'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; }> }
) {
  try {
    const session = await getAdminSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!requireRole(session, 'operator')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const resolvedParams = await params
    const evalSession = await prisma.evaluationSession.findUnique({
      where: { id: resolvedParams.sessionId },
      include: {
        applications: {
          include: {
            company: true,
            evaluationSubmissions: {
              where: {
                submissionState: 'signed',
                isValid: true
              },
              select: {
                id: true,
                submissionState: true,
                scoresJson: true,
                totalScore: true,
                committeeMemberId: true
              }
            }
          }
        },
        formDefinition: {
          include: {
            submissions: {
              where: {
                submissionState: 'signed',
                isValid: true
              },
              select: {
                id: true,
                scoresJson: true,
                totalScore: true
              }
            }
          }
        }
      }
    })

    if (!evalSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (evalSession.status !== 'closed') {
      return NextResponse.json(
        { error: 'Session must be closed before aggregation' },
        { status: 400 }
      )
    }

    const existingAggregation = await prisma.aggregationRun.findFirst({
      where: {
        sessionId: resolvedParams.sessionId,
        successCount: { gt: 0 }
      },
      orderBy: {
        computedAt: 'desc'
      }
    })

    if (existingAggregation) {
      return NextResponse.json(
        { error: 'Aggregation already exists for this session' },
        { status: 409 }
      )
    }

    const aggregationRun = await prisma.aggregationRun.create({
      data: {
        sessionId: resolvedParams.sessionId,
        triggerType: 'manual',
        triggerReason: 'Manual aggregation via admin panel',
        applicationsCount: evalSession.applications.length,
        computedById: session.id
      }
    })

    try {
      const results = await Promise.all(
        evalSession.applications.map(async (application) => {
          const submissions = application.evaluationSubmissions
            .filter(sub => sub.submissionState === 'signed')
            .map(sub => ({
              committeeMemberId: sub.committeeMemberId,
              scores: sub.scoresJson as Record<string, number> | null,
              totalScore: sub.totalScore
            }))

          if (submissions.length === 0) {
            return {
              applicationId: application.id,
              success: false,
              error: 'No valid submissions'
            }
          }

          const formDefinition = evalSession.formDefinition
          if (!formDefinition) {
            return {
              applicationId: application.id,
              success: false,
              error: 'Form definition not found'
            }
          }

          const rawScoresJson: Record<string, Record<string, number>> = {}
          const trimmedScoresJson: Record<string, number> = {}

          submissions.forEach(sub => {
            if (sub.scores) {
              const scores = sub.scores
              Object.keys(scores).forEach(criterionId => {
                if (!rawScoresJson[criterionId]) {
                  rawScoresJson[criterionId] = {}
                }
                rawScoresJson[criterionId][sub.committeeMemberId] = scores[criterionId]!
              })
            }
          })

          Object.keys(rawScoresJson).forEach(criterionId => {
            const scores = Object.values(rawScoresJson[criterionId])
            if (scores.length >= 3) {
              const sorted = [...scores].sort((a, b) => a - b)
              trimmedScoresJson[criterionId] =
                sorted.slice(1, -1).reduce((sum, val) => sum + val, 0) /
                (sorted.length - 2)
            } else {
              trimmedScoresJson[criterionId] =
                scores.reduce((sum, val) => sum + val, 0) / scores.length
            }
          })

          let finalScore = 0
          const schemaJson = formDefinition.schemaJson as FormSchema | null
          if (!schemaJson?.sections) {
            return {
              applicationId: application.id,
              success: false,
              error: 'Form schema is invalid'
            }
          }
          const sections = schemaJson.sections
          sections.forEach(section => {
            section.items.forEach((item: FormItem) => {
              if (item.type === 'radio_score' && trimmedScoresJson[item.id] !== undefined) {
                finalScore += trimmedScoresJson[item.id] * (item.weight / 100)
              }
            })
          })

          return {
            applicationId: application.id,
            success: true,
            rawScores: rawScoresJson,
            trimmedScores: trimmedScoresJson,
            finalScore: parseFloat(finalScore.toFixed(2)),
            rank: 0
          }
        })
      )

      type SuccessfulResult = typeof results[number] & { success: true; finalScore: number; rank: number }
      const successfulResults = (results
        .filter(r => r.success) as SuccessfulResult[])
        .sort((a, b) => b.finalScore - a.finalScore)

      let rank = 1
      successfulResults.forEach((result, index) => {
        if (index > 0) {
          const prev = successfulResults[index - 1]
          if (Math.abs(result.finalScore - prev.finalScore) < 0.01) {
            result.rank = prev.rank
          } else {
            result.rank = index + 1
          }
        } else {
          result.rank = 1
        }
      })

      results.forEach(result => {
        if (result.success) {
          const found = successfulResults.find(
            r => r.applicationId === result.applicationId
          )
          if (found) {
            result.rank = found.rank
          }
        }
      })

      const successfulResultsData = results
        .filter(r => r.success) as SuccessfulResult[]
      
      const resultJsonData = {
        results: results.map(r => ({
          applicationId: r.applicationId,
          companyName:
            evalSession.applications.find(
              a => a.id === r.applicationId
            )?.company.name || 'Unknown',
          finalScore: r.success ? r.finalScore : null,
          rank: r.success ? r.rank : null,
          error: r.success ? null : r.error
        })),
        computedAt: new Date()
      }

      await prisma.$transaction(async (tx) => {
        const snapshotCreates = successfulResultsData.map(result =>
          tx.resultSnapshot.create({
            data: {
              applicationId: result.applicationId,
              sessionId: resolvedParams.sessionId,
              rawScoresJson: result.rawScores as any,
              trimmedScoresJson: result.trimmedScores as any,
              finalScore: result.finalScore,
              rank: result.rank,
              computedAt: new Date(),
              computedById: session.id
            }
          })
        )
        
        await tx.aggregationRun.update({
          where: { id: aggregationRun.id },
          data: {
            successCount: successfulResultsData.length,
            errorCount: evalSession.applications.length - successfulResultsData.length,
            resultJson: resultJsonData as any
          }
        })
        
        await Promise.all(snapshotCreates)
      })

      return NextResponse.json({
        success: true,
        aggregationRunId: aggregationRun.id,
        results: results.map(r => ({
          applicationId: r.applicationId,
          companyName:
            evalSession.applications.find(a => a.id === r.applicationId)
              ?.company.name || 'Unknown',
          finalScore: r.success ? r.finalScore : null,
          rank: r.success ? r.rank : null,
          error: r.success ? null : r.error
        })),
        computedAt: new Date()
      })
    } catch (error) {
      await prisma.aggregationRun.update({
        where: { id: aggregationRun.id },
        data: {
          errorCount: evalSession.applications.length,
          resultJson: {
            error: error instanceof Error ? error.message : 'Unknown error',
            computedAt: new Date().toISOString()
          }
        }
      })

      throw error
    }
  } catch (error) {
    console.error('Aggregation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}