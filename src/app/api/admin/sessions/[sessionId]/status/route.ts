import { NextResponse } from 'next/server'
import { ApplicationStatus, type Prisma, type SessionStatus } from '@/generated/prisma/client'
import { z } from 'zod'

import { verifySession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'
import { canTransition, type EvaluationSessionStatus } from '@/lib/session'

const statusBodySchema = z.object({
  status: z.enum(['open', 'in_progress', 'closed', 'finalized', 'reopened']),
  reason: z.string().trim().optional(),
})

function unauthorized() {
  return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function trimScores(rawScores: number[], trimRule: string) {
  if (trimRule === 'exclude_min_max' && rawScores.length > 2) {
    const sorted = [...rawScores].sort((a, b) => a - b)
    return sorted.slice(1, sorted.length - 1)
  }

  return rawScores
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const adminSession = await verifySession('admin_session', request)

  if (!adminSession) {
    return unauthorized()
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: '요청 본문이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const parsed = statusBodySchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const { sessionId } = await context.params
  const { status: targetStatus, reason } = parsed.data

  const session = await prisma.evaluationSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      trimRule: true,
      formDefinition: {
        select: {
          id: true,
        },
      },
    },
  })

  if (!session) {
    return NextResponse.json(
      { error: '평가 회차를 찾을 수 없습니다' },
      { status: 404 },
    )
  }

  if (!canTransition(session.status, targetStatus as EvaluationSessionStatus)) {
    return NextResponse.json(
      { error: '허용되지 않는 상태 전이입니다' },
      { status: 400 },
    )
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (targetStatus === 'open') {
        if (!session.formDefinition) {
          const latestTemplateVersion = await tx.formTemplateVersion.findFirst({
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              schemaJson: true,
              totalScore: true,
              itemsCount: true,
            },
          })

          if (!latestTemplateVersion) {
            throw new Error('평가표 템플릿 버전이 없어 회차를 오픈할 수 없습니다')
          }

          await tx.sessionFormDefinition.create({
            data: {
              sessionId: session.id,
              schemaJson: latestTemplateVersion.schemaJson as Prisma.InputJsonValue,
              totalScore: latestTemplateVersion.totalScore,
              itemsCount: latestTemplateVersion.itemsCount,
              snapshotAt: new Date(),
              formTemplateVersionId: latestTemplateVersion.id,
            },
          })
        }

        return tx.evaluationSession.update({
          where: { id: session.id },
          data: {
            status: 'open',
            openedAt: new Date(),
          },
        })
      }

      if (targetStatus === 'in_progress') {
        return tx.evaluationSession.update({
          where: { id: session.id },
          data: {
            status: 'in_progress',
          },
        })
      }

      if (targetStatus === 'closed') {
        return tx.evaluationSession.update({
          where: { id: session.id },
          data: {
            status: 'closed',
            closedAt: new Date(),
          },
        })
      }

      if (targetStatus === 'reopened') {
        await tx.evaluationSubmission.updateMany({
          where: {
            sessionId: session.id,
            isValid: true,
          },
          data: {
            isValid: false,
            invalidatedReason: reason || '회차 재개방으로 평가 제출이 무효화되었습니다',
            invalidatedAt: new Date(),
          },
        })

        const applicationsCount = await tx.application.count({
          where: {
            sessionId: session.id,
            status: {
              not: ApplicationStatus.excluded,
            },
          },
        })

        await tx.aggregationRun.create({
          data: {
            sessionId: session.id,
            triggerType: 'reopen',
            triggerReason: reason || null,
            applicationsCount,
            successCount: 0,
            errorCount: 0,
            computedById: adminSession.sub,
          },
        })

        return tx.evaluationSession.update({
          where: { id: session.id },
          data: {
            status: 'in_progress',
            finalizedAt: null,
            closedAt: null,
          },
        })
      }

      const applications = await tx.application.findMany({
        where: {
          sessionId: session.id,
          status: {
            not: ApplicationStatus.excluded,
          },
        },
        orderBy: [{ evaluationOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          evaluationOrder: true,
        },
      })

      const snapshotsInput = await Promise.all(
        applications.map(async (application) => {
          const submissions = await tx.evaluationSubmission.findMany({
            where: {
              sessionId: session.id,
              applicationId: application.id,
              isValid: true,
              totalScore: {
                not: null,
              },
            },
            select: {
              id: true,
              totalScore: true,
            },
          })

          const rawScores = submissions
            .map((submission) => submission.totalScore)
            .filter((value): value is number => typeof value === 'number')

          const trimmedScores = trimScores(rawScores, session.trimRule)
          const finalScore = average(trimmedScores.length > 0 ? trimmedScores : rawScores)

          return {
            applicationId: application.id,
            evaluationOrder: application.evaluationOrder,
            rawScores,
            trimmedScores,
            finalScore,
          }
        }),
      )

      const ranked = [...snapshotsInput].sort((a, b) => {
        if (b.finalScore === a.finalScore) {
          return a.evaluationOrder - b.evaluationOrder
        }

        return b.finalScore - a.finalScore
      })

      const finalizedAt = new Date()

      for (const [index, item] of ranked.entries()) {
        await tx.resultSnapshot.upsert({
          where: {
            applicationId: item.applicationId,
          },
          create: {
            sessionId: session.id,
            applicationId: item.applicationId,
            rawScoresJson: item.rawScores as Prisma.InputJsonValue,
            trimmedScoresJson: item.trimmedScores as Prisma.InputJsonValue,
            finalScore: item.finalScore,
            rank: index + 1,
            computedById: adminSession.sub,
            finalizedAt,
          },
          update: {
            rawScoresJson: item.rawScores as Prisma.InputJsonValue,
            trimmedScoresJson: item.trimmedScores as Prisma.InputJsonValue,
            finalScore: item.finalScore,
            rank: index + 1,
            computedById: adminSession.sub,
            finalizedAt,
          },
        })
      }

      await tx.aggregationRun.create({
        data: {
          sessionId: session.id,
          triggerType: 'manual',
          triggerReason: reason || null,
          applicationsCount: ranked.length,
          successCount: ranked.length,
          errorCount: 0,
          resultJson: {
            rankings: ranked.map((item, index) => ({
              applicationId: item.applicationId,
              rank: index + 1,
              finalScore: item.finalScore,
            })),
          },
          computedById: adminSession.sub,
        },
      })

      return tx.evaluationSession.update({
        where: { id: session.id },
        data: {
          status: 'finalized',
          finalizedAt,
        },
      })
    })

    return NextResponse.json(updated, { status: 200 })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : '상태 변경 처리 중 오류가 발생했습니다'

    return NextResponse.json({ error: message }, { status: 400 })
  }
}
