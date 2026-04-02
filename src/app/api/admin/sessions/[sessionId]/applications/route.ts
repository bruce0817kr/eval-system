import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getAdminSession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const createApplicationSchema = z.object({
  companyId: z.string().trim().min(1),
  evaluationOrder: z.number().int().min(0).optional(),
  notes: z.string().trim().optional(),
})

const updateApplicationSchema = z.object({
  applicationId: z.string().trim().min(1),
  evaluationOrder: z.number().int().min(0).optional(),
  status: z.enum(['registered', 'evaluating', 'completed', 'excluded']).optional(),
  notes: z.string().trim().nullable().optional(),
})

const deleteApplicationSchema = z.object({
  applicationId: z.string().trim().min(1),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const admin = await getAdminSession(request)

  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { sessionId } = await params
  const { searchParams } = new URL(request.url)
  const query = listQuerySchema.safeParse({
    page: searchParams.get('page') ?? undefined,
    pageSize: searchParams.get('pageSize') ?? undefined,
  })

  if (!query.success) {
    return NextResponse.json({ error: '쿼리 파라미터가 올바르지 않습니다' }, { status: 400 })
  }

  const { page, pageSize } = query.data
  const skip = (page - 1) * pageSize

  const [total, items] = await Promise.all([
    prisma.application.count({ where: { sessionId } }),
    prisma.application.findMany({
      where: { sessionId },
      orderBy: [{ evaluationOrder: 'asc' }, { createdAt: 'asc' }],
      skip,
      take: pageSize,
      include: {
        company: true,
      },
    }),
  ])

  return NextResponse.json({
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const admin = await getAdminSession(request)

  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { sessionId } = await params
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 })
  }

  const parsed = createApplicationSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다' }, { status: 400 })
  }

  const company = await prisma.company.findUnique({
    where: { id: parsed.data.companyId },
    select: { id: true },
  })

  if (!company) {
    return NextResponse.json({ error: '기업을 찾을 수 없습니다' }, { status: 404 })
  }

  const duplicate = await prisma.application.findUnique({
    where: {
      sessionId_companyId: {
        sessionId,
        companyId: parsed.data.companyId,
      },
    },
    select: { id: true },
  })

  if (duplicate) {
    return NextResponse.json({ error: '이미 세션에 등록된 기업입니다' }, { status: 409 })
  }

  const maxOrder = await prisma.application.aggregate({
    where: { sessionId },
    _max: { evaluationOrder: true },
  })

  const application = await prisma.application.create({
    data: {
      sessionId,
      companyId: parsed.data.companyId,
      evaluationOrder:
        parsed.data.evaluationOrder ?? (maxOrder._max.evaluationOrder ?? 0) + 1,
      notes: parsed.data.notes,
      status: 'registered',
    },
    include: {
      company: true,
    },
  })

  return NextResponse.json(application, { status: 201 })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const admin = await getAdminSession(request)

  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { sessionId } = await params
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 })
  }

  const parsed = updateApplicationSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다' }, { status: 400 })
  }

  const existing = await prisma.application.findFirst({
    where: {
      id: parsed.data.applicationId,
      sessionId,
    },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json({ error: '신청 정보를 찾을 수 없습니다' }, { status: 404 })
  }

  const updated = await prisma.application.update({
    where: { id: parsed.data.applicationId },
    data: {
      evaluationOrder: parsed.data.evaluationOrder,
      status: parsed.data.status,
      notes: parsed.data.notes,
    },
    include: {
      company: true,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const admin = await getAdminSession(request)

  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { sessionId } = await params
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 })
  }

  const parsed = deleteApplicationSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다' }, { status: 400 })
  }

  const existing = await prisma.application.findFirst({
    where: {
      id: parsed.data.applicationId,
      sessionId,
    },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json({ error: '신청 정보를 찾을 수 없습니다' }, { status: 404 })
  }

  await prisma.application.delete({
    where: { id: parsed.data.applicationId },
  })

  return NextResponse.json({ ok: true })
}
