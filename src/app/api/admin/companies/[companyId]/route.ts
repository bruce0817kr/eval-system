import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getAdminSession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'

const updateCompanySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    ceoName: z.string().trim().nullable().optional(),
    businessNumber: z.string().trim().nullable().optional(),
    address: z.string().trim().nullable().optional(),
    phone: z.string().trim().nullable().optional(),
    email: z.string().trim().email('이메일 형식이 올바르지 않습니다').nullable().optional(),
    industry: z.string().trim().nullable().optional(),
    foundedDate: z.coerce.date().nullable().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: '수정할 필드를 최소 1개 이상 전달해주세요',
  })

export async function GET(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const admin = await getAdminSession(request)

  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { companyId } = await params

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      applications: {
        select: {
          id: true,
          sessionId: true,
          status: true,
          evaluationOrder: true,
          createdAt: true,
        },
      },
    },
  })

  if (!company) {
    return NextResponse.json({ error: '기업을 찾을 수 없습니다' }, { status: 404 })
  }

  return NextResponse.json(company)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const admin = await getAdminSession(request)

  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { companyId } = await params
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 })
  }

  const parsed = updateCompanySchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const existing = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json({ error: '기업을 찾을 수 없습니다' }, { status: 404 })
  }

  if (parsed.data.businessNumber) {
    const duplicate = await prisma.company.findFirst({
      where: {
        businessNumber: parsed.data.businessNumber,
        NOT: { id: companyId },
      },
      select: { id: true },
    })

    if (duplicate) {
      return NextResponse.json({ error: '이미 등록된 사업자등록번호입니다' }, { status: 409 })
    }
  }

  const updated = await prisma.company.update({
    where: { id: companyId },
    data: parsed.data,
  })

  try {
    await prisma.auditEvent.create({
      data: {
        actorType: 'admin',
        actorId: admin.id,
        action: 'update',
        targetType: 'Company',
        targetId: companyId,
        ipAddress:
          request.headers.get('x-forwarded-for') ??
          request.headers.get('x-real-ip') ??
          null,
      },
    })
  } catch (e) {
    console.error('Audit log failed:', e)
  }

  return NextResponse.json(updated)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const admin = await getAdminSession(request)

  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { companyId } = await params

  const usedInApplications = await prisma.application.findFirst({
    where: { companyId },
    select: { id: true },
  })

  if (usedInApplications) {
    return NextResponse.json(
      { error: '세션 신청 이력이 있는 기업은 삭제할 수 없습니다' },
      { status: 409 },
    )
  }

  const existing = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json({ error: '기업을 찾을 수 없습니다' }, { status: 404 })
  }

  await prisma.company.delete({
    where: { id: companyId },
  })

  try {
    await prisma.auditEvent.create({
      data: {
        actorType: 'admin',
        actorId: admin.id,
        action: 'delete',
        targetType: 'Company',
        targetId: companyId,
        ipAddress:
          request.headers.get('x-forwarded-for') ??
          request.headers.get('x-real-ip') ??
          null,
      },
    })
  } catch (e) {
    console.error('Audit log failed:', e)
  }

  return NextResponse.json({ ok: true })
}
