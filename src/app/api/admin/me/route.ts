import { NextResponse } from 'next/server'

import { getAdminSession } from '@/lib/auth/jwt'

export async function GET(request: Request) {
  const session = await getAdminSession(request)

  if (!session) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  return NextResponse.json({
    id: session.id,
    email: session.email,
    name: session.name,
    role: session.role,
  })
}
