import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

import { logAuditEvent as writeAuditEvent } from '@/lib/audit'

type SessionPayload = {
  sub?: string
  type?: 'admin' | 'committee'
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET

  if (!secret) {
    throw new Error('AUTH_SECRET is not configured')
  }

  return new TextEncoder().encode(secret)
}

async function verifySession(cookieValue?: string): Promise<SessionPayload | null> {
  if (!cookieValue) {
    return null
  }

  try {
    const { payload } = await jwtVerify(cookieValue, getAuthSecret())
    return payload as SessionPayload
  } catch {
    return null
  }
}

function getClientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

function getRequestId(request: Request) {
  return request.headers.get('x-request-id') ?? null
}

async function safeLogAuditEvent(input: {
  actorType: 'admin' | 'committee_member' | 'system'
  actorId: string
  action: 'logout'
  targetType?: string
  targetId?: string
  requestId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  payloadJson?: Record<string, unknown>
}) {
  try {
    await writeAuditEvent({
      ...input,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      requestId: input.requestId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      payloadJson: input.payloadJson ?? null,
    })
  } catch {
  }
}

export async function POST(request: NextRequest) {
  const adminSession = await verifySession(request.cookies.get('admin_session')?.value)
  const committeeSession = await verifySession(
    request.cookies.get('committee_session')?.value,
  )

  const requestId = getRequestId(request)
  const ipAddress = getClientIp(request)
  const userAgent = request.headers.get('user-agent')

  if (adminSession?.type === 'admin' && adminSession.sub) {
    await safeLogAuditEvent({
      actorType: 'admin',
      actorId: adminSession.sub,
      action: 'logout',
      targetType: 'admin_user',
      targetId: adminSession.sub,
      requestId,
      ipAddress,
      userAgent,
    })
  }

  if (committeeSession?.type === 'committee' && committeeSession.sub) {
    await safeLogAuditEvent({
      actorType: 'committee_member',
      actorId: committeeSession.sub,
      action: 'logout',
      targetType: 'committee_member',
      targetId: committeeSession.sub,
      requestId,
      ipAddress,
      userAgent,
    })
  }

  const response = NextResponse.json({ message: '로그아웃되었습니다' }, { status: 200 })

  for (const cookieName of [
    'admin_session',
    'committee_session',
    'admin_csrf_token',
  ]) {
    response.cookies.set({
      name: cookieName,
      value: '',
      httpOnly: cookieName !== 'admin_csrf_token',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    })
  }

  return response
}
