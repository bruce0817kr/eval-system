import { NextResponse } from 'next/server'

import { logAuditEvent as logAudit } from '@/lib/audit'
import { verifySession } from '@/lib/auth/jwt'

function getClientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

export async function POST(request: Request) {
  try {
    const payload =
      (await verifySession('eval_session', request)) ??
      (await verifySession('committee_session', request))

    if (payload?.sub && typeof payload.sub === 'string') {
      try {
        await logAudit({
          actorType: 'committee_member',
          actorId: payload.sub,
          action: 'logout',
          targetType: 'committee_member',
          targetId: payload.sub,
          ipAddress: getClientIp(request),
          userAgent: request.headers.get('user-agent') ?? null,
        })
      } catch {
      }
    }

    const response = NextResponse.json({ ok: true }, { status: 200 })

    for (const cookieName of ['eval_session', 'committee_session']) {
      response.cookies.set({
        name: cookieName,
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 0,
      })
    }

    return response
  } catch {
    return NextResponse.json({ error: '로그아웃 처리에 실패했습니다' }, { status: 500 })
  }
}
