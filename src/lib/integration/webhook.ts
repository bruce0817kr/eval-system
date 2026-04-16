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
    event: 'evaluation.finalized',
    sessionId: session.id,
    title: session.title,
    status: session.status,
    finalizedAt: session.finalizedAt?.toISOString() ?? new Date().toISOString(),
    selectedApplications,
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

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    console.error('Integration finalized webhook failed:', error)
  }
}
