import { jwtVerify, type JWTPayload } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const adminSessionSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['admin', 'operator', 'auditor']),
  type: z.literal('admin'),
})

const committeeSessionSchema = z.object({
  sub: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(1),
  type: z.literal('committee'),
})

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET

  if (!secret) {
    throw new Error('AUTH_SECRET is not configured')
  }

  return new TextEncoder().encode(secret)
}

async function verifySession(cookieValue?: string): Promise<JWTPayload | null> {
  if (!cookieValue) {
    return null
  }

  const secret = getAuthSecret()

  try {
    const { payload } = await jwtVerify(cookieValue, secret)
    return payload
  } catch {
    return null
  }
}

function isApiRoute(pathname: string) {
  return pathname.startsWith('/api/')
}

function isPublicRoute(pathname: string) {
  return (
    pathname === '/admin/login' ||
    pathname === '/eval/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/auth' ||
    pathname.startsWith('/api/eval/auth/') ||
    pathname === '/api/eval/auth' ||
    pathname === '/api/admin/auth/login' ||
    pathname === '/api/admin/auth/register'
  )
}

function getRequiredAuthType(pathname: string) {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return 'admin' as const
  }

  if (pathname.startsWith('/api/admin/')) {
    return 'admin' as const
  }

  if (pathname === '/eval/sessions' || pathname.startsWith('/eval/sessions/')) {
    return 'committee' as const
  }

  if (pathname.startsWith('/api/eval/') && !pathname.startsWith('/api/eval/auth/')) {
    return 'committee' as const
  }

  const segments = pathname.split('/').filter(Boolean)

  if (
    segments[0] === 'eval' &&
    typeof segments[1] === 'string' &&
    segments[1] !== 'login' &&
    segments[1] !== 'sessions'
  ) {
    return 'committee' as const
  }

  return null
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function forbiddenResponse(pathname: string) {
  if (isApiRoute(pathname)) {
    return jsonError('접근 권한이 없습니다', 403)
  }

  return new NextResponse('접근 권한이 없습니다', { status: 403 })
}

function unauthenticatedResponse(request: NextRequest, requiredType: 'admin' | 'committee') {
  if (isApiRoute(request.nextUrl.pathname)) {
    return jsonError('인증이 필요합니다', 401)
  }

  const loginPath = requiredType === 'admin' ? '/admin/login' : '/eval/login'
  return NextResponse.redirect(new URL(loginPath, request.url))
}

function configurationError(pathname: string) {
  if (isApiRoute(pathname)) {
    return jsonError('인증 설정이 올바르지 않습니다', 500)
  }

  return new NextResponse('인증 설정이 올바르지 않습니다', { status: 500 })
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  const requiredAuthType = getRequiredAuthType(pathname)

  if (!requiredAuthType) {
    return NextResponse.next()
  }

  let adminPayload: JWTPayload | null
  let committeePayload: JWTPayload | null

  try {
    adminPayload = await verifySession(request.cookies.get('admin_session')?.value)
    committeePayload =
      (await verifySession(request.cookies.get('eval_session')?.value)) ??
      (await verifySession(request.cookies.get('committee_session')?.value))
  } catch {
    return configurationError(pathname)
  }

  const adminSession = adminSessionSchema.safeParse(adminPayload)
  const committeeSession = committeeSessionSchema.safeParse(committeePayload)

  if (requiredAuthType === 'admin') {
    if (adminSession.success) {
      return NextResponse.next()
    }

    if (committeeSession.success) {
      return forbiddenResponse(pathname)
    }

    return unauthenticatedResponse(request, 'admin')
  }

  if (committeeSession.success) {
    return NextResponse.next()
  }

  if (adminSession.success) {
    return forbiddenResponse(pathname)
  }

  return unauthenticatedResponse(request, 'committee')
}

export const config = {
  matcher: ['/admin/:path*', '/eval/:path*', '/api/admin/:path*', '/api/eval/:path*'],
}
