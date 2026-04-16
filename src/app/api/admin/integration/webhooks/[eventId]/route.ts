import { NextResponse } from 'next/server'

import { getAdminSession, requireRole } from '@/lib/auth/jwt'
import { getIntegrationWebhookDelivery } from '@/lib/integration/webhook'

type RouteContext = {
  params: Promise<{ eventId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const admin = await getAdminSession(request)

  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!requireRole(admin, 'operator')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { eventId } = await context.params
  const delivery = await getIntegrationWebhookDelivery(decodeURIComponent(eventId))

  if (!delivery) {
    return NextResponse.json({ error: 'Webhook delivery was not found' }, { status: 404 })
  }

  return NextResponse.json({ delivery })
}
