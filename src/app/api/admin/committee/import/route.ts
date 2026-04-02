import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getAdminSession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'

const phoneRegex = /^010(?:-?\d{4}){2}$/

const memberSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력해주세요'),
  phone: z.string().trim().regex(phoneRegex, '연락처 형식이 올바르지 않습니다'),
  organization: z.string().trim().max(100).optional().or(z.literal('')),
  position: z.string().trim().max(100).optional().or(z.literal('')),
  field: z.string().trim().max(100).optional().or(z.literal('')),
})

const bulkImportSchema = z.object({
  members: z.array(memberSchema).min(1, '등록할 위원 데이터가 없습니다'),
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

  const parsed = bulkImportSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const errors: Array<{ index: number; message: string }> = []
  const seenPhones = new Set<string>()
  let success = 0

  for (const [index, member] of parsed.data.members.entries()) {
    const normalizedPhone = normalizePhone(member.phone)

    if (seenPhones.has(normalizedPhone)) {
      errors.push({ index, message: '요청 내 연락처가 중복되었습니다' })
      continue
    }

    seenPhones.add(normalizedPhone)

    const duplicated = await prisma.committeeMember.findFirst({
      where: { phone: normalizedPhone },
      select: { id: true },
    })

    if (duplicated) {
      errors.push({ index, message: '이미 등록된 연락처입니다' })
      continue
    }

    await prisma.committeeMember.create({
      data: {
        name: member.name.trim(),
        phone: normalizedPhone,
        organization: toNullableString(member.organization),
        position: toNullableString(member.position),
        field: toNullableString(member.field),
      },
    })

    success += 1
  }

  return NextResponse.json({ success, errors }, { status: 200 })
}
