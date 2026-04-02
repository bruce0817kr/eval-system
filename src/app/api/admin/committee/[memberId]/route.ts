import { NextResponse } from 'next/server'
import { z } from 'zod'

import { SessionStatus } from '@/generated/prisma/client'
import { getAdminSession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'

const phoneRegex = /^010(?:-?\d{4}){2}$/

const updateMemberSchema = z
  .object({
    name: z.string().trim().min(1, '이름을 입력해주세요').optional(),
    phone: z
      .string()
      .trim()
      .regex(phoneRegex, '연락처 형식이 올바르지 않습니다')
      .optional(),
    organization: z.string().trim().max(100).optional().or(z.literal('')),
    position: z.string().trim().max(100).optional().or(z.literal('')),
    field: z.string().trim().max(100).optional().or(z.literal('')),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: '수정할 항목을 입력해주세요',
  })

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '')
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
}

function toNullableString(value: string | undefined) {
  if (value === undefined) {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

type MemberRouteContext = {
  params: Promise<{ memberId: string }>
}

export async function GET(request: Request, context: MemberRouteContext) {
  const adminSession = await getAdminSession(request)

  if (!adminSession) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { memberId } = await context.params

  const member = await prisma.committeeMember.findUnique({
    where: { id: memberId },
  })

  if (!member) {
    return NextResponse.json({ error: '평가위원을 찾을 수 없습니다' }, { status: 404 })
  }

  return NextResponse.json(member, { status: 200 })
}

export async function PATCH(request: Request, context: MemberRouteContext) {
  const adminSession = await getAdminSession(request)

  if (!adminSession) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { memberId } = await context.params

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 })
  }

  const parsed = updateMemberSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const existingMember = await prisma.committeeMember.findUnique({
    where: { id: memberId },
    select: { id: true },
  })

  if (!existingMember) {
    return NextResponse.json({ error: '평가위원을 찾을 수 없습니다' }, { status: 404 })
  }

  const normalizedPhone = parsed.data.phone
    ? normalizePhone(parsed.data.phone)
    : undefined

  if (normalizedPhone) {
    const duplicated = await prisma.committeeMember.findFirst({
      where: {
        phone: normalizedPhone,
        id: { not: memberId },
      },
      select: { id: true },
    })

    if (duplicated) {
      return NextResponse.json({ error: '이미 등록된 연락처입니다' }, { status: 409 })
    }
  }

  const updated = await prisma.committeeMember.update({
    where: { id: memberId },
    data: {
      name: parsed.data.name?.trim(),
      phone: normalizedPhone,
      organization: toNullableString(parsed.data.organization),
      position: toNullableString(parsed.data.position),
      field: toNullableString(parsed.data.field),
      isActive: parsed.data.isActive,
    },
  })

  return NextResponse.json(updated, { status: 200 })
}

export async function DELETE(request: Request, context: MemberRouteContext) {
  const adminSession = await getAdminSession(request)

  if (!adminSession) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { memberId } = await context.params

  const existingMember = await prisma.committeeMember.findUnique({
    where: { id: memberId },
    select: { id: true },
  })

  if (!existingMember) {
    return NextResponse.json({ error: '평가위원을 찾을 수 없습니다' }, { status: 404 })
  }

  const activeAssignments = await prisma.sessionCommitteeAssignment.count({
    where: {
      committeeMemberId: memberId,
      session: {
        status: {
          in: [SessionStatus.draft, SessionStatus.open, SessionStatus.in_progress],
        },
      },
    },
  })

  if (activeAssignments > 0) {
    return NextResponse.json(
      { error: '활성 회차에 배정된 위원은 비활성화할 수 없습니다' },
      { status: 409 },
    )
  }

  const deactivated = await prisma.committeeMember.update({
    where: { id: memberId },
    data: { isActive: false },
  })

  return NextResponse.json(deactivated, { status: 200 })
}
