import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getAdminSession } from '@/lib/auth/jwt'
import { logAuditEvent } from '@/lib/audit'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { prisma } from '@/lib/db'

const passwordSchema = z.object({
  currentPassword: z.string().min(1, '현재 비밀번호를 입력해주세요'),
  newPassword: z
    .string()
    .min(8, '새 비밀번호는 8자 이상이어야 합니다')
    .max(128, '새 비밀번호는 128자 이하여야 합니다'),
})

export async function POST(request: Request) {
  const admin = await getAdminSession(request)
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 })
  }

  const parsed = passwordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const { currentPassword, newPassword } = parsed.data

  const user = await prisma.adminUser.findUnique({
    where: { id: admin.id },
    select: { id: true, passwordHash: true },
  })

  if (!user) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 })
  }

  const isValid = await verifyPassword(currentPassword, user.passwordHash)
  if (!isValid) {
    return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다' }, { status: 400 })
  }

  const newHash = await hashPassword(newPassword)
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash: newHash },
  })

  try {
    await logAuditEvent({
      actorType: 'admin',
      actorId: admin.id,
      action: 'update',
      targetType: 'AdminUser',
      targetId: admin.id,
      ipAddress:
        request.headers.get('x-forwarded-for') ??
        request.headers.get('x-real-ip') ??
        null,
      payloadJson: { field: 'password' },
    })
  } catch (e) {
    console.error('Audit log failed:', e)
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: 'admin_session',
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
  return response
}
