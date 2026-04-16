import { NextResponse } from 'next/server'

import { getAdminSession, requireRole } from '@/lib/auth/jwt'
import { listIntegrationWebhookDeliveries } from '@/lib/integration/webhook'

export async function GET(request: Request) {
  const admin = await getAdminSession(request)

  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!requireRole(admin, 'operator')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 50) || 50, 200)
  const deliveries = await listIntegrationWebhookDeliveries(limit)

  return NextResponse.json({ deliveries })
}
