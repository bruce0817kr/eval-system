import { NextResponse } from 'next/server'
import { ApplicationStatus, type Prisma } from '@/generated/prisma/client'
import { z } from 'zod'

import { getAdminSession } from '@/lib/auth/jwt'
import { logAuditEvent } from '@/lib/audit'
import { prisma } from '@/lib/db'
import { notifyIntegrationSessionFinalized } from '@/lib/integration/webhook'
import { canTransition, type EvaluationSessionStatus } from '@/lib/session'

const statusBodySchema = z.object({
  status: z.enum(['open', 'in_progress', 'closed', 'finalized', 'reopened']),
  reason: z.string().trim().optional(),
})

function unauthorized() {
  return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const adminSession = await getAdminSession(request)

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
            computedById: adminSession.id,
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

      // finalize: 기존 ResultSnapshot을 그대로 사용 (재계산 없음)
      const existingSnapshots = await tx.resultSnapshot.findMany({
        where: { sessionId: session.id },
        select: { applicationId: true, rank: true, finalScore: true },
      })

      if (existingSnapshots.length === 0) {
        throw new Error('집계를 먼저 실행해주세요')
      }

      const finalizedAt = new Date()

      await tx.resultSnapshot.updateMany({
        where: { sessionId: session.id },
        data: { finalizedAt },
      })

      await tx.aggregationRun.create({
        data: {
          sessionId: session.id,
          triggerType: 'finalize',
          triggerReason: reason || null,
          applicationsCount: existingSnapshots.length,
          successCount: existingSnapshots.length,
          errorCount: 0,
          resultJson: {
            rankings: existingSnapshots.map((s) => ({
              applicationId: s.applicationId,
              rank: s.rank,
              finalScore: s.finalScore,
            })),
          },
          computedById: adminSession.id,
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

    const auditAction =
      targetStatus === 'finalized' ? 'finalize' :
      targetStatus === 'reopened' ? 'reopen' : 'update'

    try {
      await logAuditEvent({
        actorType: 'admin',
        actorId: adminSession.id,
        action: auditAction,
        targetType: 'EvaluationSession',
        targetId: sessionId,
        sessionId,
        ipAddress:
          request.headers.get('x-forwarded-for') ??
          request.headers.get('x-real-ip') ??
          null,
        payloadJson: { targetStatus, reason: reason ?? null },
      })
    } catch (e) {
      console.error('Audit log failed:', e)
    }

    if (targetStatus === 'finalized') {
      await notifyIntegrationSessionFinalized(sessionId)
    }

    return NextResponse.json(updated, { status: 200 })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : '상태 변경 처리 중 오류가 발생했습니다'

    return NextResponse.json({ error: message }, { status: 400 })
  }
}
