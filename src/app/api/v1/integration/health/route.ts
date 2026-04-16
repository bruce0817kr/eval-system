import {
  integrationOk,
  integrationUnauthorized,
  verifyIntegrationRequest,
} from '@/lib/integration/auth'

export async function GET(request: Request) {
  if (!verifyIntegrationRequest(request)) {
    return integrationUnauthorized()
  }

  return integrationOk({
    version: 'v1',
    auth: 'bearer',
    timestamp: new Date().toISOString(),
  })
}
