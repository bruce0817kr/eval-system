import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getAdminSession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'
import type { AuditAction } from '@/generated/prisma/client'

const VALID_ACTIONS: AuditAction[] = [
  'login','logout','view','create','update','delete',
  'submit','sign','reopen','finalize','import','export','download','aggregate',
]

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  sessionId: z.string().optional(),
  actorType: z.enum(['admin', 'committee_member', 'system']).optional(),
  action: z.string().optional().transform(v => (v && VALID_ACTIONS.includes(v as AuditAction) ? v as AuditAction : undefined)),
})

export async function GET(request: Request) {
  const admin = await getAdminSession(request)
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = querySchema.safeParse({
    page: searchParams.get('page') ?? undefined,
    pageSize: searchParams.get('pageSize') ?? undefined,
    sessionId: searchParams.get('sessionId') ?? undefined,
    actorType: searchParams.get('actorType') ?? undefined,
    action: searchParams.get('action') ?? undefined,
  })

  if (!query.success) {
    return NextResponse.json({ error: '쿼리 파라미터가 올바르지 않습니다' }, { status: 400 })
  }

  const { page, pageSize, sessionId, actorType, action } = query.data
  const skip = (page - 1) * pageSize

  const where = {
    ...(sessionId ? { sessionId } : {}),
    ...(actorType ? { actorType } : {}),
    ...(action ? { action } : {}),
  }

  const [total, events] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        session: { select: { id: true, title: true } },
      },
    }),
  ])

  // 행위자 이름 일괄 조회
  const adminIds = [...new Set(events.filter(e => e.actorType === 'admin').map(e => e.actorId))]
  const memberIds = [...new Set(events.filter(e => e.actorType === 'committee_member').map(e => e.actorId))]

  const [adminUsers, committeeMembers] = await Promise.all([
    adminIds.length > 0
      ? prisma.adminUser.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true } })
      : [],
    memberIds.length > 0
      ? prisma.committeeMember.findMany({ where: { id: { in: memberIds } }, select: { id: true, name: true } })
      : [],
  ])

  const nameMap: Record<string, string> = {}
  for (const u of adminUsers) nameMap[u.id] = u.name
  for (const m of committeeMembers) nameMap[m.id] = m.name

  const eventsWithNames = events.map(e => ({
    ...e,
    actorName: nameMap[e.actorId] ?? null,
  }))

  return NextResponse.json({
    events: eventsWithNames,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
}
