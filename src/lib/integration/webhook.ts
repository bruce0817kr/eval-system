import { createHmac } from 'node:crypto'

import type { Prisma } from '@/generated/prisma/client'
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

  await prisma.integrationWebhookDelivery.upsert({
    where: { eventId: input.payload.eventId },
    create: {
      eventId: input.payload.eventId,
      eventType: input.payload.event,
      url: input.url,
      payloadJson: input.payload as Prisma.InputJsonValue,
      status: 'pending',
    },
    update: {
      url: input.url,
      payloadJson: input.payload as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  })

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

      await prisma.integrationWebhookDelivery.update({
        where: { eventId: input.payload.eventId },
        data: {
          attempts: { increment: 1 },
          lastStatus: response.status,
          lastError: null,
          updatedAt: new Date(),
        },
      })

      if (response.ok) {
        await prisma.integrationWebhookDelivery.update({
          where: { eventId: input.payload.eventId },
          data: {
            status: 'delivered',
            deliveredAt: new Date(),
            updatedAt: new Date(),
          },
        })
        return
      }

      throw new Error(`Webhook responded with ${response.status}`)
    } catch (error) {
      if (attempt === maxAttempts) {
        await prisma.integrationWebhookDelivery.update({
          where: { eventId: input.payload.eventId },
          data: {
            status: 'failed',
            lastError: error instanceof Error ? error.message : String(error),
            updatedAt: new Date(),
          },
        })
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
  const delivery = await prisma.integrationWebhookDelivery.findUnique({
    where: { eventId },
    select: { url: true, payloadJson: true },
  })

  if (!delivery) {
    return false
  }

  await sendWebhookWithRetries({
    url: delivery.url,
    payload: delivery.payloadJson as { eventId: string; event: string },
    maxAttempts: 1,
  })
  return true
}

export async function listIntegrationWebhookDeliveries(limit = 50) {
  const rows = await prisma.integrationWebhookDelivery.findMany({
    orderBy: { updatedAt: 'desc' },
    take: limit,
  })

  return rows.map((row) => ({
    eventId: row.eventId,
    eventType: row.eventType,
    url: row.url,
    status: row.status,
    attempts: row.attempts,
    lastStatus: row.lastStatus,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
  }))
}

export async function listIntegrationWebhookDeliveriesPage(input: {
  page: number
  pageSize: number
  status?: string | null
}) {
  const offset = (input.page - 1) * input.pageSize
  const where = input.status ? { status: input.status } : {}
  const [rows, total] = await Promise.all([
    prisma.integrationWebhookDelivery.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: input.pageSize,
    }),
    prisma.integrationWebhookDelivery.count({ where }),
  ])

  const deliveries = rows.map((row) => ({
    eventId: row.eventId,
    eventType: row.eventType,
    url: row.url,
    status: row.status,
    attempts: row.attempts,
    lastStatus: row.lastStatus,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
  }))

  return {
    deliveries,
    total,
  }
}
