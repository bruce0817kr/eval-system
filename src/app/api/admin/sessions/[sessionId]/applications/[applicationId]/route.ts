import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getAdminSession } from '@/lib/auth/jwt'
import { logAuditEvent } from '@/lib/audit'
import { prisma } from '@/lib/db'

const patchSchema = z.object({
  status: z.enum(['registered', 'evaluating', 'completed', 'excluded']).optional(),
  notes: z.string().trim().nullable().optional(),
  evaluationOrder: z.number().int().min(0).optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; applicationId: string }> },
) {
  const admin = await getAdminSession(request)
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { sessionId, applicationId } = await params

  const application = await prisma.application.findFirst({
    where: { id: applicationId, sessionId },
    include: {
      company: true,
      documents: {
        orderBy: { uploadedAt: 'desc' },
      },
      evaluationSubmissions: {
        include: {
          committeeMember: {
            select: { id: true, name: true, organization: true },
          },
          signatureArtifact: {
            select: { id: true, signedAt: true, otpVerified: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      resultSnapshots: {
        orderBy: { computedAt: 'desc' },
        take: 1,
      },
    },
  })

  if (!application) {
    return NextResponse.json({ error: '신청 정보를 찾을 수 없습니다' }, { status: 404 })
  }

  return NextResponse.json(application)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; applicationId: string }> },
) {
  const admin = await getAdminSession(request)
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { sessionId, applicationId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다' }, { status: 400 })
  }

  const existing = await prisma.application.findFirst({
    where: { id: applicationId, sessionId },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json({ error: '신청 정보를 찾을 수 없습니다' }, { status: 404 })
  }

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      ...(parsed.data.evaluationOrder !== undefined
        ? { evaluationOrder: parsed.data.evaluationOrder }
        : {}),
    },
    include: { company: true },
  })

  try {
    await logAuditEvent({
      actorType: 'admin',
      actorId: admin.id,
      action: 'update',
      targetType: 'Application',
      targetId: applicationId,
      sessionId,
      ipAddress:
        request.headers.get('x-forwarded-for') ??
        request.headers.get('x-real-ip') ??
        null,
      payloadJson: parsed.data,
    })
  } catch (e) {
    console.error('Audit log failed:', e)
  }

  return NextResponse.json(updated)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; applicationId: string }> },
) {
  const admin = await getAdminSession(request)
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { sessionId, applicationId } = await params

  const existing = await prisma.application.findFirst({
    where: { id: applicationId, sessionId },
    select: {
      id: true,
      evaluationSubmissions: {
        where: { submissionState: { in: ['submitted', 'signed'] } },
        select: { id: true },
        take: 1,
      },
    },
  })

  if (!existing) {
    return NextResponse.json({ error: '신청 정보를 찾을 수 없습니다' }, { status: 404 })
  }

  if (existing.evaluationSubmissions.length > 0) {
    return NextResponse.json(
      { error: '제출된 평가가 있는 기업은 삭제할 수 없습니다' },
      { status: 409 },
    )
  }

  await prisma.application.delete({ where: { id: applicationId } })

  return NextResponse.json({ ok: true })
}
