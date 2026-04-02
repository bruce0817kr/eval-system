import { createHash, createHmac, randomUUID } from 'node:crypto'

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { logAuditEvent as logAudit } from '@/lib/audit'
import { verifySession } from '@/lib/auth/jwt'
import { verifyOtp } from '@/lib/auth/otp'
import { prisma } from '@/lib/db'
import { uploadFile } from '@/lib/storage'

const signSchema = z.object({
  submissionId: z.string().trim().min(1),
  signatureImageDataUrl: z.string().trim().min(1),
  otpCode: z.string().trim().regex(/^\d{6}$/),
})

async function getEvaluatorId(request: Request) {
  const payload =
    (await verifySession('eval_session', request)) ??
    (await verifySession('committee_session', request))

  if (!payload?.sub || typeof payload.sub !== 'string') {
    return null
  }

  return payload.sub
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET

  if (!secret) {
    throw new Error('AUTH_SECRET is not configured')
  }

  return secret
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/)

  if (!match) {
    return null
  }

  const mimeType = match[1]
  const base64 = match[2]

  try {
    const buffer = Buffer.from(base64, 'base64')
    return { mimeType, buffer }
  } catch {
    return null
  }
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null'
  }

  if (typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }

  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>
    const keys = Object.keys(objectValue).sort()
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
      .join(',')}}`
  }

  return JSON.stringify(String(value))
}

function getClientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const committeeMemberId = await getEvaluatorId(request)

    if (!committeeMemberId) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { sessionId } = await params

    let body: unknown

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 })
    }

    const parsed = signSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
        { status: 400 },
      )
    }

    const member = await prisma.committeeMember.findUnique({
      where: { id: committeeMemberId },
      select: {
        id: true,
        name: true,
        phone: true,
        isActive: true,
      },
    })

    if (!member || !member.isActive) {
      return NextResponse.json({ error: '평가위원 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    const submission = await prisma.evaluationSubmission.findFirst({
      where: {
        id: parsed.data.submissionId,
        sessionId,
        committeeMemberId,
      },
      select: {
        id: true,
        answersJson: true,
        submissionState: true,
      },
    })

    if (!submission) {
      return NextResponse.json({ error: '제출 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    if (submission.submissionState === 'signed') {
      return NextResponse.json({ error: '이미 서명 완료된 제출입니다' }, { status: 409 })
    }

    const otpVerified = await verifyOtp(member.phone.replace(/-/g, ''), parsed.data.otpCode)

    if (!otpVerified) {
      return NextResponse.json({ error: 'OTP 인증번호가 올바르지 않습니다' }, { status: 401 })
    }

    const decoded = decodeDataUrl(parsed.data.signatureImageDataUrl)

    if (!decoded) {
      return NextResponse.json({ error: '서명 이미지 형식이 올바르지 않습니다' }, { status: 400 })
    }

    const storageKey = `signatures/${sessionId}/${parsed.data.submissionId}-${randomUUID()}.png`
    await uploadFile(storageKey, decoded.buffer, decoded.mimeType)

    const canonicalJson = stableStringify(submission.answersJson)
    const canonicalJsonHash = createHash('sha256').update(canonicalJson).digest('hex')
    const serverSeal = createHmac('sha256', getAuthSecret()).update(canonicalJson).digest('hex')
    const signedAt = new Date()

    await prisma.$transaction([
      prisma.signatureArtifact.create({
        data: {
          submissionId: submission.id,
          signatureImageStorageKey: storageKey,
          otpVerified: true,
          otpPhone: member.phone,
          canonicalJsonHash,
          signerName: member.name,
          signedAt,
          ipAddress: getClientIp(request),
          userAgent: request.headers.get('user-agent') ?? null,
          serverSeal,
          serverSealAlgorithm: 'HMAC-SHA256',
        },
      }),
      prisma.evaluationSubmission.update({
        where: {
          id: submission.id,
        },
        data: {
          submissionState: 'signed',
          signedAt,
          ipAddress: getClientIp(request),
          userAgent: request.headers.get('user-agent') ?? null,
        },
      }),
    ])

    try {
      await logAudit({
        actorType: 'committee_member',
        actorId: committeeMemberId,
        action: 'sign',
        targetType: 'evaluation_submission',
        targetId: submission.id,
        sessionId,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get('user-agent') ?? null,
        payloadJson: {
          canonicalJsonHash,
          serverSealAlgorithm: 'HMAC-SHA256',
        },
      })
    } catch {
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch {
    return NextResponse.json({ error: '서명 처리에 실패했습니다' }, { status: 500 })
  }
}
