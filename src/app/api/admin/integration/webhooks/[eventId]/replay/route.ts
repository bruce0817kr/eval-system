import { NextResponse } from 'next/server'

import { getAdminSession, requireRole } from '@/lib/auth/jwt'
import { replayIntegrationWebhook } from '@/lib/integration/webhook'

type RouteContext = {
  params: Promise<{ eventId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const admin = await getAdminSession(request)

  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!requireRole(admin, 'operator')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { eventId } = await context.params
  const replayed = await replayIntegrationWebhook(decodeURIComponent(eventId))

  if (!replayed) {
    return NextResponse.json({ error: 'Webhook delivery was not found' }, { status: 404 })
  }

  return NextResponse.json({ eventId: decodeURIComponent(eventId), replayed: true })
}
