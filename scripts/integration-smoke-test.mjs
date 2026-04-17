import { Blob, File } from 'node:buffer'

const baseUrl = process.env.EVAL_BASE_URL ?? 'http://localhost:3003'
const token = process.env.INTEGRATION_API_KEY ?? 'test-integration-key'
const suffix = process.env.SMOKE_ID ?? `${Date.now()}`
const sessionId = `smoke-session-${suffix}`
const applicationId = `smoke-application-${suffix}`
const companyId = `smoke-company-${suffix}`

function endpoint(path) {
  return `${baseUrl}${path}`
}

async function readJson(response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function assertOk(response, label) {
  const body = await readJson(response)
  if (!response.ok) {
    console.error(`${label} failed`, response.status, body)
    process.exit(1)
  }
  console.log(`${label} ok`, JSON.stringify(body))
  return body
}

const headers = {
  Authorization: `Bearer ${token}`,
}

await assertOk(
  await fetch(endpoint('/api/v1/integration/health'), { headers }),
  'health',
)

await assertOk(
  await fetch(endpoint(`/api/v1/integration/sessions/${sessionId}`), {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `Smoke Evaluation ${suffix}`,
      description: 'Integration smoke test session',
      committeeSize: 5,
      trimRule: 'exclude_min_max',
    }),
  }),
  'session upsert',
)

await assertOk(
  await fetch(endpoint(`/api/v1/integration/sessions/${sessionId}/applications`), {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      applications: [
        {
          externalApplicationId: applicationId,
          evaluationOrder: 1,
          notes: 'Smoke test application',
          company: {
            externalCompanyId: companyId,
            name: `Smoke Company ${suffix}`,
            businessNumber: `999-00-${String(suffix).slice(-5).padStart(5, '0')}`,
            ceoName: 'Smoke CEO',
            phone: '02-0000-0000',
            email: `smoke-${suffix}@example.test`,
            address: 'Seoul',
            industry: 'AI',
          },
        },
      ],
    }),
  }),
  'application upsert',
)

const pdfBuffer = Buffer.from('%PDF-1.4\n% smoke test pdf\n', 'utf8')
const formData = new FormData()
formData.set('docType', 'business_plan')
formData.set(
  'file',
  new File([new Blob([pdfBuffer], { type: 'application/pdf' })], 'smoke-business-plan.pdf', {
    type: 'application/pdf',
  }),
)

await assertOk(
  await fetch(endpoint(`/api/v1/integration/applications/${applicationId}/documents`), {
    method: 'POST',
    headers: {
      ...headers,
      'Idempotency-Key': `${applicationId}-business-plan-v1`,
    },
    body: formData,
  }),
  'document upload',
)

await assertOk(
  await fetch(endpoint(`/api/v1/integration/sessions/${sessionId}/results`), { headers }),
  'results read',
)

console.log(JSON.stringify({
  status: 'ok',
  sessionId,
  applicationId,
  companyId,
}, null, 2))
