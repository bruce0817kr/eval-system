import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getAdminSession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'

const phoneRegex = /^010(?:-?\d{4}){2}$/

const createMemberSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력해주세요'),
  phone: z.string().trim().regex(phoneRegex, '연락처 형식이 올바르지 않습니다'),
  organization: z.string().trim().max(100).optional().or(z.literal('')),
  position: z.string().trim().max(100).optional().or(z.literal('')),
  field: z.string().trim().max(100).optional().or(z.literal('')),
})

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  isActive: z.enum(['true', 'false']).optional(),
})

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '')
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
}

function toNullableString(value: string | undefined) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function GET(request: Request) {
  const adminSession = await getAdminSession(request)

  if (!adminSession) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const url = new URL(request.url)
  const parsedQuery = listQuerySchema.safeParse({
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
    isActive: url.searchParams.get('isActive') ?? undefined,
  })

  if (!parsedQuery.success) {
    return NextResponse.json({ error: '조회 조건이 올바르지 않습니다' }, { status: 400 })
  }

  const { page, pageSize, search, isActive } = parsedQuery.data
  const normalizedSearch = search?.trim()

  const where = {
    ...(isActive ? { isActive: isActive === 'true' } : {}),
    ...(normalizedSearch
      ? {
          OR: [
            {
              name: {
                contains: normalizedSearch,
                mode: 'insensitive' as const,
              },
            },
            {
              phone: {
                contains: normalizedSearch,
                mode: 'insensitive' as const,
              },
            },
            {
              organization: {
                contains: normalizedSearch,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : {}),
  }

  const [members, total] = await prisma.$transaction([
    prisma.committeeMember.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.committeeMember.count({ where }),
  ])

  return NextResponse.json({ members, total }, { status: 200 })
}

export async function POST(request: Request) {
  const adminSession = await getAdminSession(request)

  if (!adminSession) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 })
  }

  const parsed = createMemberSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const normalizedPhone = normalizePhone(parsed.data.phone)

  const duplicated = await prisma.committeeMember.findFirst({
    where: { phone: normalizedPhone },
    select: { id: true },
  })

  if (duplicated) {
    return NextResponse.json({ error: '이미 등록된 연락처입니다' }, { status: 409 })
  }

  const created = await prisma.committeeMember.create({
    data: {
      name: parsed.data.name.trim(),
      phone: normalizedPhone,
      organization: toNullableString(parsed.data.organization),
      position: toNullableString(parsed.data.position),
      field: toNullableString(parsed.data.field),
    },
  })

  return NextResponse.json(created, { status: 201 })
}
