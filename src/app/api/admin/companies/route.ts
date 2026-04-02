import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getAdminSession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'

const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const companySchema = z.object({
  name: z.string().trim().min(1, '기업명은 필수입니다'),
  ceoName: z.string().trim().optional(),
  businessNumber: z.string().trim().optional(),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email('이메일 형식이 올바르지 않습니다').optional(),
  industry: z.string().trim().optional(),
  foundedDate: z.coerce.date().optional(),
})

export async function GET(request: Request) {
  const admin = await getAdminSession(request)

  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = listQuerySchema.safeParse({
    search: searchParams.get('search') ?? undefined,
    page: searchParams.get('page') ?? undefined,
    pageSize: searchParams.get('pageSize') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: '쿼리 파라미터가 올바르지 않습니다' }, { status: 400 })
  }

  const { page, pageSize, search } = parsed.data
  const skip = (page - 1) * pageSize

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { ceoName: { contains: search, mode: 'insensitive' as const } },
          { businessNumber: { contains: search, mode: 'insensitive' as const } },
          { industry: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [items, total] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.company.count({ where }),
  ])

  return NextResponse.json({
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
}

export async function POST(request: Request) {
  const admin = await getAdminSession(request)

  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 })
  }

  const parsed = companySchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  if (parsed.data.businessNumber) {
    const duplicated = await prisma.company.findFirst({
      where: { businessNumber: parsed.data.businessNumber },
      select: { id: true },
    })

    if (duplicated) {
      return NextResponse.json({ error: '이미 등록된 사업자등록번호입니다' }, { status: 409 })
    }
  }

  const company = await prisma.company.create({
    data: parsed.data,
  })

  return NextResponse.json(company, { status: 201 })
}
