import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getAdminSession, requireRole } from '@/lib/auth/jwt'
import { listIntegrationWebhookDeliveriesPage } from '@/lib/integration/webhook'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'delivered', 'failed']).optional(),
})

export async function GET(request: Request) {
  const admin = await getAdminSession(request)

  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!requireRole(admin, 'operator')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({
    page: searchParams.get('page') ?? undefined,
    pageSize: searchParams.get('pageSize') ?? undefined,
    status: searchParams.get('status') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  }

  const { deliveries, total } = await listIntegrationWebhookDeliveriesPage(parsed.data)

  return NextResponse.json({
    deliveries,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / parsed.data.pageSize)),
  })
}
