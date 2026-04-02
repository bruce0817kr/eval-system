import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getAdminSession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'
import {
  calculateTemplateStats,
  formSchemaSchema,
} from '@/lib/form-template-schema'

const createVersionSchema = z.object({
  schema: formSchemaSchema,
})

function unauthorized() {
  return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ templateId: string }> },
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

  const parsed = createVersionSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const { templateId } = await context.params
  const template = await prisma.formTemplate.findUnique({
    where: { id: templateId },
    select: { id: true },
  })

  if (!template) {
    return NextResponse.json(
      { error: '템플릿을 찾을 수 없습니다' },
      { status: 404 },
    )
  }

  const stats = calculateTemplateStats(parsed.data.schema)
  const created = await prisma.$transaction(async (tx) => {
    const current = await tx.formTemplateVersion.aggregate({
      where: { templateId },
      _max: { versionNumber: true },
    })

    const nextVersionNumber = (current._max.versionNumber ?? 0) + 1

    return tx.formTemplateVersion.create({
      data: {
        templateId,
        versionNumber: nextVersionNumber,
        schemaJson: parsed.data.schema,
        totalScore: stats.totalScore,
        itemsCount: stats.itemsCount,
      },
    })
  })

  return NextResponse.json(created, { status: 201 })
}
