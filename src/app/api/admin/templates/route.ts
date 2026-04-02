import { NextResponse } from 'next/server'
import { z } from 'zod'

import { Prisma } from '@/generated/prisma/client'
import { getAdminSession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'
import {
  calculateTemplateStats,
  formSchemaSchema,
} from '@/lib/form-template-schema'

const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  isShared: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
})

const createTemplateSchema = z.object({
  name: z.string().trim().min(1, '템플릿명을 입력해주세요'),
  description: z.string().trim().optional(),
  isShared: z.boolean().optional(),
  schema: formSchemaSchema,
})

function unauthorized() {
  return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
}

export async function GET(request: Request) {
  const adminSession = await getAdminSession(request)

  if (!adminSession) {
    return unauthorized()
  }

  const url = new URL(request.url)
  const parsed = listQuerySchema.safeParse({
    search: url.searchParams.get('search') ?? undefined,
    isShared: url.searchParams.get('isShared') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '요청 값이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const { search, isShared } = parsed.data
  const where: Prisma.FormTemplateWhereInput = {
    ...(typeof isShared === 'boolean' ? { isShared } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const templates = await prisma.formTemplate.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
      },
    },
  })

  return NextResponse.json(
    {
      templates: templates.map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        isShared: template.isShared,
        createdAt: template.createdAt,
        latestVersion: template.versions[0] ?? null,
      })),
    },
    { status: 200 },
  )
}

export async function POST(request: Request) {
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

  const parsed = createTemplateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const stats = calculateTemplateStats(parsed.data.schema)
  const created = await prisma.formTemplate.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      isShared: parsed.data.isShared ?? false,
      createdById: adminSession.id,
      versions: {
        create: {
          versionNumber: 1,
          schemaJson: parsed.data.schema,
          totalScore: stats.totalScore,
          itemsCount: stats.itemsCount,
        },
      },
    },
    include: {
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
      },
    },
  })

  return NextResponse.json(
    {
      id: created.id,
      name: created.name,
      description: created.description,
      isShared: created.isShared,
      createdAt: created.createdAt,
      latestVersion: created.versions[0] ?? null,
    },
    { status: 201 },
  )
}
