import { createHmac } from 'node:crypto'

import { prisma } from '@/lib/db'

type FinalizedWebhookApplication = {
  applicationId: string
  companyName: string
  rank: number
  finalScore: number
}

function getWebhookUrl() {
  return (
    process.env.INTEGRATION_WEBHOOK_URL ??
    (process.env.NODE_ENV !== 'production'
      ? 'http://127.0.0.1:3999/integration-webhook'
      : undefined)
  )
}

async function ensureDeliveryTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS integration_webhook_delivery (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      url TEXT NOT NULL,
      payload_json JSONB NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_status INTEGER,
      last_error TEXT,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      delivered_at TIMESTAMP(3)
    )
  `
}

async function buildFinalizedPayload(sessionId: string) {
  const session = await prisma.evaluationSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      title: true,
      status: true,
      finalizedAt: true,
      resultSnapshots: {
        where: {
          rank: {
            lte: 3,
          },
        },
        orderBy: [{ rank: 'asc' }, { finalScore: 'desc' }],
        select: {
          rank: true,
          finalScore: true,
          application: {
            select: {
              id: true,
              company: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!session) {
    return null
  }

  const selectedApplications: FinalizedWebhookApplication[] = session.resultSnapshots
    .filter((snapshot) => snapshot.rank !== null && snapshot.finalScore !== null)
    .map((snapshot) => ({
      applicationId: snapshot.application.id,
      companyName: snapshot.application.company.name,
      rank: snapshot.rank,
      finalScore: snapshot.finalScore,
    }))

  return {
    eventId: `evaluation.finalized:${session.id}:${session.finalizedAt?.toISOString() ?? 'unknown'}`,
    event: 'evaluation.finalized',
    sessionId: session.id,
    title: session.title,
    status: session.status,
    finalizedAt: session.finalizedAt?.toISOString() ?? new Date().toISOString(),
    selectedApplications,
  }
}

function getWebhookSecret() {
  return process.env.INTEGRATION_WEBHOOK_SECRET ?? process.env.AUTH_SECRET ?? 'dev-webhook-secret'
}

function signWebhookBody(body: string) {
  return `sha256=${createHmac('sha256', getWebhookSecret()).update(body).digest('hex')}`
}

function retryDelayMs(attempt: number) {
  return attempt * 100
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function sendWebhookWithRetries(input: {
  url: string
  payload: { eventId: string; event: string }
  maxAttempts?: number
}) {
  const body = JSON.stringify(input.payload)
  const maxAttempts = input.maxAttempts ?? 3

  await ensureDeliveryTable()
  await prisma.$executeRaw`
    INSERT INTO integration_webhook_delivery (event_id, event_type, url, payload_json, status, updated_at)
    VALUES (${input.payload.eventId}, ${input.payload.event}, ${input.url}, ${body}::jsonb, 'pending', CURRENT_TIMESTAMP)
    ON CONFLICT (event_id) DO UPDATE SET
      url = EXCLUDED.url,
      payload_json = EXCLUDED.payload_json,
      updated_at = CURRENT_TIMESTAMP
  `

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(input.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Event-Id': input.payload.eventId,
          'X-Signature': signWebhookBody(body),
        },
        body,
      })

      await prisma.$executeRaw`
        UPDATE integration_webhook_delivery
        SET attempts = attempts + 1,
            last_status = ${response.status},
            last_error = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE event_id = ${input.payload.eventId}
      `

      if (response.ok) {
        await prisma.$executeRaw`
          UPDATE integration_webhook_delivery
          SET status = 'delivered',
              delivered_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE event_id = ${input.payload.eventId}
        `
        return
      }

      throw new Error(`Webhook responded with ${response.status}`)
    } catch (error) {
      if (attempt === maxAttempts) {
        await prisma.$executeRaw`
          UPDATE integration_webhook_delivery
          SET status = 'failed',
              last_error = ${error instanceof Error ? error.message : String(error)},
              updated_at = CURRENT_TIMESTAMP
          WHERE event_id = ${input.payload.eventId}
        `
        console.error('Integration finalized webhook failed:', error)
        return
      }

      await sleep(retryDelayMs(attempt))
    }
  }
}

export async function notifyIntegrationSessionFinalized(sessionId: string) {
  const url = getWebhookUrl()
  if (!url) {
    return
  }

  const payload = await buildFinalizedPayload(sessionId)
  if (!payload) {
    return
  }

  await sendWebhookWithRetries({ url, payload })
}

export async function replayIntegrationWebhook(eventId: string) {
  await ensureDeliveryTable()

  const rows = await prisma.$queryRaw<Array<{ url: string; payload_json: { eventId: string; event: string } }>>`
    SELECT url, payload_json
    FROM integration_webhook_delivery
    WHERE event_id = ${eventId}
    LIMIT 1
  `
  const delivery = rows[0]

  if (!delivery) {
    return false
  }

  await sendWebhookWithRetries({
    url: delivery.url,
    payload: delivery.payload_json,
    maxAttempts: 1,
  })
  return true
}
