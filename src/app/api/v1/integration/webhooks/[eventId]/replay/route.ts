import { NextResponse } from 'next/server'

import {
  integrationError,
  integrationUnauthorized,
  verifyIntegrationRequest,
} from '@/lib/integration/auth'
import { replayIntegrationWebhook } from '@/lib/integration/webhook'

type RouteContext = {
  params: Promise<{ eventId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  if (!verifyIntegrationRequest(request)) {
    return integrationUnauthorized()
  }

  const { eventId } = await context.params
  const replayed = await replayIntegrationWebhook(decodeURIComponent(eventId))

  if (!replayed) {
    return integrationError('WEBHOOK_DELIVERY_NOT_FOUND', 'Webhook delivery was not found', 404)
  }

  return NextResponse.json({ eventId: decodeURIComponent(eventId), replayed: true })
}
