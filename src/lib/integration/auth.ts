import { NextResponse } from 'next/server'

const DEV_INTEGRATION_API_KEY = 'test-integration-key'

export function getIntegrationApiKey() {
  return (
    process.env.INTEGRATION_API_KEY ??
    (process.env.NODE_ENV !== 'production' ? DEV_INTEGRATION_API_KEY : undefined)
  )
}

export function verifyIntegrationRequest(request: Request) {
  const configuredKey = getIntegrationApiKey()
  const authorization = request.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : null

  return Boolean(configuredKey && token && token === configuredKey)
}

export function integrationUnauthorized() {
  return NextResponse.json(
    {
      status: 'failed',
      message: 'Missing or invalid integration bearer token',
    },
    { status: 401 },
  )
}

export function integrationError(code: string, message: string, status: number, details?: unknown) {
  const envelopeStatus = status === 404 ? 'not_found' : 'failed'
  return NextResponse.json(
    {
      status: envelopeStatus,
      message,
      data: {
        code,
        ...(details === undefined ? {} : { details }),
      },
    },
    { status },
  )
}

export function integrationOk<T>(data: T) {
  return NextResponse.json({ status: 'ok', data })
}

export function integrationUpdated<T>(data: T) {
  return NextResponse.json({ status: 'updated', data })
}

export function integrationCreated<T>(data: T) {
  return NextResponse.json({ status: 'created', data }, { status: 201 })
}
