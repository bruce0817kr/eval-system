import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getAdminSession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'

const patchTemplateSchema = z
  .object({
    name: z.string().trim().min(1, '템플릿명을 입력해주세요').optional(),
    description: z.string().trim().optional(),
    isShared: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.isShared !== undefined,
    { message: '수정할 항목을 하나 이상 입력해주세요' },
  )

function unauthorized() {
  return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
}

export async function GET(
  request: Request,
  context: { params: Promise<{ templateId: string }> },
) {
  const adminSession = await getAdminSession(request)

  if (!adminSession) {
    return unauthorized()
  }

  const { templateId } = await context.params
  const template = await prisma.formTemplate.findUnique({
    where: { id: templateId },
    include: {
      versions: {
        orderBy: { versionNumber: 'desc' },
      },
    },
  })

  if (!template) {
    return NextResponse.json(
      { error: '템플릿을 찾을 수 없습니다' },
      { status: 404 },
    )
  }

  return NextResponse.json(template, { status: 200 })
}

export async function PATCH(
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

  const parsed = patchTemplateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const { templateId } = await context.params
  const existing = await prisma.formTemplate.findUnique({
    where: { id: templateId },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json(
      { error: '템플릿을 찾을 수 없습니다' },
      { status: 404 },
    )
  }

  const updated = await prisma.formTemplate.update({
    where: { id: templateId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description || null }
        : {}),
      ...(parsed.data.isShared !== undefined
        ? { isShared: parsed.data.isShared }
        : {}),
    },
  })

  return NextResponse.json(updated, { status: 200 })
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ templateId: string }> },
) {
  const adminSession = await getAdminSession(request)

  if (!adminSession) {
    return unauthorized()
  }

  const { templateId } = await context.params
  const template = await prisma.formTemplate.findUnique({
    where: { id: templateId },
    include: {
      versions: {
        select: { id: true },
      },
    },
  })

  if (!template) {
    return NextResponse.json(
      { error: '템플릿을 찾을 수 없습니다' },
      { status: 404 },
    )
  }

  const versionIds = template.versions.map((version) => version.id)
  const usageCount = versionIds.length
    ? await prisma.sessionFormDefinition.count({
        where: {
          formTemplateVersionId: {
            in: versionIds,
          },
        },
      })
    : 0

  if (usageCount > 0) {
    return NextResponse.json(
      { error: '이미 회차에 사용된 템플릿은 삭제할 수 없습니다' },
      { status: 409 },
    )
  }

  await prisma.formTemplate.delete({ where: { id: templateId } })

  return NextResponse.json({ success: true }, { status: 200 })
}
