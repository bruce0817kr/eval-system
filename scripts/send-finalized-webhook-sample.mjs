import { createHmac } from 'node:crypto'

const url = process.env.WEBHOOK_URL
const secret = process.env.INTEGRATION_WEBHOOK_HMAC_SECRET

if (!url || !secret) {
  console.error('Usage: WEBHOOK_URL=<url> INTEGRATION_WEBHOOK_HMAC_SECRET=<secret> node scripts/send-finalized-webhook-sample.mjs')
  process.exit(1)
}

const finalizedAt = new Date().toISOString()
const eventId = `evaluation.finalized:sample-session:${finalizedAt}`
const payload = {
  eventId,
  event: 'evaluation.finalized',
  sessionId: 'sample-session',
  title: 'Sample Evaluation Session',
  status: 'finalized',
  finalizedAt,
  selectedApplications: [
    {
      applicationId: 'sample-application-1',
      companyName: 'Sample Company 1',
      rank: 1,
      finalScore: 94.5,
    },
    {
      applicationId: 'sample-application-2',
      companyName: 'Sample Company 2',
      rank: 2,
      finalScore: 91.2,
    },
    {
      applicationId: 'sample-application-3',
      companyName: 'Sample Company 3',
      rank: 3,
      finalScore: 88.7,
    },
  ],
}

const body = JSON.stringify(payload)
const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Event-Id': eventId,
    'X-Signature': signature,
  },
  body,
})

const responseText = await response.text()
console.log(JSON.stringify({
  ok: response.ok,
  status: response.status,
  eventId,
  signature,
  response: responseText,
}, null, 2))

if (!response.ok) {
  process.exit(1)
}
