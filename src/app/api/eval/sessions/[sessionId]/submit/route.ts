import { createHash } from 'node:crypto'

import { type Prisma } from '@/generated/prisma/client'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { logAuditEvent as logAudit } from '@/lib/audit'
import { verifySession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'
import {
  type FormSchema,
  formSchemaSchema,
} from '@/lib/form-template-schema'

const submitSchema = z.object({
  applicationId: z.string().trim().min(1),
  answersJson: z.record(z.string(), z.unknown()),
})

type ScoreDetails = {
  perItem: Record<string, { rawScore: number; weightedScore: number; maxScore: number }>
  perSection: Record<string, { score: number; maxScore: number }>
  totalScore: number
  maxScore: number
}

async function getEvaluatorId(request: Request) {
  const payload =
    (await verifySession('eval_session', request)) ??
    (await verifySession('committee_session', request))

  if (!payload?.sub || typeof payload.sub !== 'string') {
    return null
  }

  return payload.sub
}

function parseRequiredError(schema: FormSchema, answers: Record<string, unknown>) {
  const missing: string[] = []

  for (const section of schema.sections) {
    for (const item of section.items) {
      const answer = answers[item.id]

      if (item.type === 'heading') {
        continue
      }

      if (!item.required) {
        continue
      }

      if (item.type === 'text') {
        if (typeof answer !== 'string' || answer.trim().length === 0) {
          missing.push(item.label)
        }
        continue
      }

      if (item.type === 'radio_score') {
        if (typeof answer !== 'number') {
          missing.push(item.label)
        }
      }
    }
  }

  return missing
}

function calculateScore(schema: FormSchema, answers: Record<string, unknown>): ScoreDetails {
  const perItem: ScoreDetails['perItem'] = {}
  const perSection: ScoreDetails['perSection'] = {}
  let totalScore = 0
  let maxScore = 0

  for (const section of schema.sections) {
    let sectionScore = 0
    let sectionMax = 0

    for (const item of section.items) {
      if (item.type !== 'radio_score') {
        continue
      }

      const selectedScore = answers[item.id]
      const maxOptionScore = Math.max(...item.options.map((option) => option.score))
      const numericSelected = typeof selectedScore === 'number' ? selectedScore : 0
      const weightedScore =
        maxOptionScore > 0 ? (numericSelected / maxOptionScore) * item.weight : 0

      perItem[item.id] = {
        rawScore: numericSelected,
        weightedScore,
        maxScore: item.weight,
      }

      sectionScore += weightedScore
      sectionMax += item.weight
      totalScore += weightedScore
      maxScore += item.weight
    }

    perSection[section.id] = {
      score: sectionScore,
      maxScore: sectionMax,
    }
  }

  return {
    perItem,
    perSection,
    totalScore,
    maxScore,
  }
}

function getClientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

function buildSubmissionHash(answersJson: Record<string, unknown>) {
  return createHash('sha256').update(JSON.stringify(answersJson)).digest('hex')
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const committeeMemberId = await getEvaluatorId(request)

    if (!committeeMemberId) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { sessionId } = await params

    let body: unknown

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 })
    }

    const parsed = submitSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
        { status: 400 },
      )
    }

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

    const { applicationId, answersJson } = parsed.data

    const existingSubmission = await prisma.evaluationSubmission.findFirst({
      where: {
        applicationId,
        committeeMemberId,
        sessionId,
      },
      select: {
        id: true,
        submissionState: true,
      },
    })

    if (existingSubmission) {
      if (existingSubmission.submissionState === 'signed') {
        return NextResponse.json(
          { error: '이미 서명이 완료된 평가입니다. 다시 제출할 수 없습니다.' },
          { status: 409 },
        )
      }

      return NextResponse.json(
        {
          error: '이미 제출된 평가입니다.',
          existingSubmissionId: existingSubmission.id,
          submissionState: existingSubmission.submissionState,
        },
        { status: 409 },
      )
    }

    const [application, formDefinition] = await Promise.all([
      prisma.application.findFirst({
        where: {
          id: applicationId,
          sessionId,
        },
        select: {
          id: true,
          companyId: true,
        },
      }),
      prisma.sessionFormDefinition.findUnique({
        where: { sessionId },
        select: {
          id: true,
          schemaJson: true,
        },
      }),
    ])

    if (!application) {
      return NextResponse.json({ error: '신청 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    if (!formDefinition) {
      return NextResponse.json({ error: '세션 평가표가 설정되지 않았습니다' }, { status: 409 })
    }

    const schemaResult = formSchemaSchema.safeParse(formDefinition.schemaJson)

    if (!schemaResult.success) {
      return NextResponse.json({ error: '평가표 스키마가 올바르지 않습니다' }, { status: 500 })
    }

    const missing = parseRequiredError(schemaResult.data, answersJson)

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: '필수 항목을 모두 입력해 주세요',
          missing,
        },
        { status: 400 },
      )
    }

    const scoreResult = calculateScore(schemaResult.data, answersJson)
    const submission = await prisma.evaluationSubmission.create({
      data: {
        applicationId,
        committeeMemberId,
        sessionId,
        formSnapshotId: formDefinition.id,
        submissionState: 'submitted',
        answersJson: answersJson as Prisma.InputJsonValue,
        scoresJson: scoreResult as Prisma.InputJsonValue,
        totalScore: scoreResult.totalScore,
        isValid: true,
        submittedAt: new Date(),
        ipAddress: getClientIp(request),
        userAgent: request.headers.get('user-agent') ?? null,
      },
    })

    try {
      await logAudit({
        actorType: 'committee_member',
        actorId: committeeMemberId,
        action: 'submit',
        targetType: 'evaluation_submission',
        targetId: submission.id,
        sessionId,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get('user-agent') ?? null,
        payloadJson: {
          applicationId,
          answersHash: buildSubmissionHash(answersJson),
          totalScore: scoreResult.totalScore,
        },
      })
    } catch {
    }

    return NextResponse.json({ submission }, { status: 201 })
  } catch {
    return NextResponse.json({ error: '제출 처리에 실패했습니다' }, { status: 500 })
  }
}
