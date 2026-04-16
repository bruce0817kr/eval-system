import { readFileSync } from 'node:fs'

const specPath = 'docs/api/integration-openapi.yaml'
const spec = readFileSync(specPath, 'utf8')

const requiredSnippets = [
  'openapi: 3.1.0',
  'bearerAuth:',
  '/api/v1/integration/sessions/{externalSessionId}:',
  '/api/v1/integration/sessions/{externalSessionId}/applications:',
  '/api/v1/integration/sessions/{externalSessionId}/results:',
  '/api/v1/integration/applications/{externalApplicationId}/documents:',
  '/api/v1/integration/webhooks/{eventId}/replay:',
  'evaluationFinalized:',
  'X-Event-Id',
  'X-Signature',
  'Idempotency-Key',
  'SessionUpsertRequest:',
  'ApplicationsUpsertRequest:',
  'DocumentUploadRequest:',
  'ResultsResponse:',
  'WebhookReplayResponse:',
]

const missing = requiredSnippets.filter((snippet) => !spec.includes(snippet))

if (missing.length > 0) {
  console.error(`OpenAPI spec check failed: ${specPath}`)
  for (const snippet of missing) {
    console.error(`- missing: ${snippet}`)
  }
  process.exit(1)
}

console.log(`OpenAPI spec check passed: ${specPath}`)
