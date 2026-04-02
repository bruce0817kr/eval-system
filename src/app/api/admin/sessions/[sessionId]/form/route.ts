import { NextResponse } from 'next/server'
import { type Prisma } from '@/generated/prisma/client'
import { z } from 'zod'

import { verifySession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'

const formBodySchema = z.object({
  templateVersionId: z.string().trim().min(1, '템플릿 버전을 선택해주세요'),
})

function unauthorized() {
  return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
}

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const adminSession = await verifySession('admin_session', request)

  if (!adminSession) {
    return unauthorized()
  }

  const { sessionId } = await context.params
  const formDefinition = await prisma.sessionFormDefinition.findUnique({
    where: { sessionId },
  })

  if (!formDefinition) {
    return NextResponse.json(
      { error: '회차 평가표가 아직 설정되지 않았습니다' },
      { status: 404 },
    )
  }

  return NextResponse.json(formDefinition, { status: 200 })
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

  const parsed = formBodySchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const { sessionId } = await context.params

  const session = await prisma.evaluationSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
    },
  })

  if (!session) {
    return NextResponse.json(
      { error: '평가 회차를 찾을 수 없습니다' },
      { status: 404 },
    )
  }

  if (session.status !== 'draft') {
    return NextResponse.json(
      { error: '평가표는 초안 상태에서만 설정할 수 있습니다' },
      { status: 409 },
    )
  }

  const templateVersion = await prisma.formTemplateVersion.findUnique({
    where: { id: parsed.data.templateVersionId },
    select: {
      id: true,
      schemaJson: true,
      totalScore: true,
      itemsCount: true,
    },
  })

  if (!templateVersion) {
    return NextResponse.json(
      { error: '선택한 템플릿 버전을 찾을 수 없습니다' },
      { status: 404 },
    )
  }

  const formDefinition = await prisma.sessionFormDefinition.upsert({
    where: { sessionId },
    create: {
      sessionId,
      schemaJson: templateVersion.schemaJson as Prisma.InputJsonValue,
      totalScore: templateVersion.totalScore,
      itemsCount: templateVersion.itemsCount,
      snapshotAt: new Date(),
      formTemplateVersionId: templateVersion.id,
    },
    update: {
      schemaJson: templateVersion.schemaJson as Prisma.InputJsonValue,
      totalScore: templateVersion.totalScore,
      itemsCount: templateVersion.itemsCount,
      snapshotAt: new Date(),
      formTemplateVersionId: templateVersion.id,
    },
  })

  return NextResponse.json(formDefinition, { status: 201 })
}
