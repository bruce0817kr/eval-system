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

async function verifyToken(token?: string): Promise<JWTPayload | null> {
  if (!token) {
    return null
  }

  const secret = getAuthSecret()

  try {
    const { payload } = await jwtVerify(token, secret)
    return payload
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  let adminPayload: JWTPayload | null = null
  let committeePayload: JWTPayload | null = null

  try {
    adminPayload = await verifyToken(request.cookies.get('admin_session')?.value)
    committeePayload = await verifyToken(
      request.cookies.get('committee_session')?.value,
    )
  } catch {
    return NextResponse.json(
      { error: '인증 설정이 올바르지 않습니다' },
      { status: 500 },
    )
  }

  const adminSession = adminSessionSchema.safeParse(adminPayload)

  if (adminSession.success) {
    return NextResponse.json(
      {
        id: adminSession.data.sub,
        email: adminSession.data.email,
        name: adminSession.data.name,
        role: adminSession.data.role,
        type: adminSession.data.type,
      },
      { status: 200 },
    )
  }

  const committeeSession = committeeSessionSchema.safeParse(committeePayload)

  if (committeeSession.success) {
    return NextResponse.json(
      {
        id: committeeSession.data.sub,
        name: committeeSession.data.name,
        phone: committeeSession.data.phone,
        type: committeeSession.data.type,
      },
      { status: 200 },
    )
  }

  return NextResponse.json(
    { error: '인증 정보가 없습니다' },
    { status: 401 },
  )
}
