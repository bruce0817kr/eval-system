import { NextResponse } from 'next/server'
import { SessionStatus } from '@/generated/prisma/client'
import { z } from 'zod'

import { verifySession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  status: z.nativeEnum(SessionStatus).optional(),
  search: z.string().trim().optional(),
})

const createSessionSchema = z.object({
  title: z.string().trim().min(1, '회차명을 입력해주세요'),
  description: z.string().trim().optional(),
  committeeSize: z
    .number({ error: '위원 수는 숫자여야 합니다' })
    .int('위원 수는 정수여야 합니다')
    .min(1, '위원 수는 1명 이상이어야 합니다')
    .max(50, '위원 수는 50명 이하여야 합니다')
    .optional(),
  trimRule: z.string().trim().min(1, '절사 규칙을 입력해주세요').optional(),
})

function unauthorized() {
  return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
}

export async function GET(request: Request) {
  const session = await verifySession('admin_session', request)

  if (!session) {
    return unauthorized()
  }

  const url = new URL(request.url)
  const parsed = listQuerySchema.safeParse({
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '요청 값이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const { page, pageSize, status, search } = parsed.data
  const where = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          title: {
            contains: search,
            mode: 'insensitive' as const,
          },
        }
      : {}),
  }

  const [sessions, total] = await Promise.all([
    prisma.evaluationSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        status: true,
        committeeSize: true,
        createdAt: true,
        _count: {
          select: {
            applications: true,
            committeeMembers: true,
          },
        },
      },
    }),
    prisma.evaluationSession.count({ where }),
  ])

  return NextResponse.json({ sessions, total }, { status: 200 })
}

export async function POST(request: Request) {
  const session = await verifySession('admin_session', request)

  if (!session) {
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

  const parsed = createSessionSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const created = await prisma.evaluationSession.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      committeeSize: parsed.data.committeeSize ?? 5,
      trimRule: parsed.data.trimRule ?? 'exclude_min_max',
      status: 'draft',
      createdById: String(session.sub),
    },
    include: {
      _count: {
        select: {
          applications: true,
          committeeMembers: true,
        },
      },
    },
  })

  return NextResponse.json(created, { status: 201 })
}
