import { expect, test } from '@playwright/test'

const API_KEY = 'test-integration-key'
const AUTH_HEADER = `Bearer ${API_KEY}`
const EXTERNAL_SESSION_ID = 'external-session-restapi'
const EXTERNAL_APPLICATION_ID = 'external-application-restapi-1'

test.describe('business-management integration REST API', () => {
  test('reports integration API health and version', async ({ request }) => {
    const response = await request.get('/api/v1/integration/health', {
      headers: { Authorization: AUTH_HEADER },
    })

    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual(
      expect.objectContaining({
        status: 'ok',
        data: expect.objectContaining({
          version: 'v1',
          auth: 'bearer',
        }),
      }),
    )
  })

  test('rejects requests without bearer token', async ({ request }) => {
    const response = await request.put('/api/v1/integration/sessions/external-auth-check', {
      data: {
        title: 'Auth check session',
      },
    })

    expect(response.status()).toBe(401)
    expect(await response.json()).toEqual({
      status: 'failed',
      message: 'Missing or invalid integration bearer token',
    })
  })

  test('upserts a session and applications, then exposes integration results', async ({
    request,
  }) => {
    const documentIdempotencyKey = `document-upload-restapi-${Date.now()}`
    const sessionResponse = await request.put(
      `/api/v1/integration/sessions/${EXTERNAL_SESSION_ID}`,
      {
        headers: { Authorization: AUTH_HEADER },
        data: {
          title: 'External support program',
          description: 'Synchronized from business-management system',
          committeeSize: 5,
          trimRule: 'exclude_min_max',
        },
      },
    )

    expect(sessionResponse.status()).toBe(200)
    expect(await sessionResponse.json()).toEqual(
      expect.objectContaining({
        status: 'updated',
        data: expect.objectContaining({
          externalSessionId: EXTERNAL_SESSION_ID,
          title: 'External support program',
          status: 'draft',
        }),
      }),
    )

    const applicationsResponse = await request.put(
      `/api/v1/integration/sessions/${EXTERNAL_SESSION_ID}/applications`,
      {
        headers: { Authorization: AUTH_HEADER },
        data: {
          applications: [
            {
              externalApplicationId: EXTERNAL_APPLICATION_ID,
              company: {
                externalCompanyId: 'external-company-restapi-1',
                name: 'External Company 1',
                businessNumber: '777-66-55001',
                ceoName: 'External CEO',
                phone: '02-1111-2222',
                email: 'integration-company-1@example.test',
                address: 'Seoul',
                industry: 'AI',
              },
              evaluationOrder: 1,
              notes: 'Synchronized from business-management system',
            },
          ],
        },
      },
    )

    expect(applicationsResponse.status()).toBe(200)
    expect(await applicationsResponse.json()).toEqual(
      expect.objectContaining({
        status: 'updated',
        data: expect.objectContaining({
          externalSessionId: EXTERNAL_SESSION_ID,
          upsertedCount: 1,
          applications: [
            expect.objectContaining({
              externalApplicationId: EXTERNAL_APPLICATION_ID,
              companyName: 'External Company 1',
            }),
          ],
        }),
      }),
    )

    const documentResponse = await request.post(
      `/api/v1/integration/applications/${EXTERNAL_APPLICATION_ID}/documents`,
      {
        headers: {
          Authorization: AUTH_HEADER,
          'Idempotency-Key': documentIdempotencyKey,
        },
        multipart: {
          file: {
            name: 'external-business-plan.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('%PDF-1.4\n% external integration test pdf\n', 'utf8'),
          },
          docType: 'business_plan',
        },
      },
    )

    expect(documentResponse.status()).toBe(201)
    const documentBody = (await documentResponse.json()) as {
      status: string
      data: {
        externalApplicationId: string
        document: {
          id: string
          originalFilename: string
          mimeType: string
          fileSize: number
        }
      }
    }
    expect(documentBody).toEqual(
      expect.objectContaining({
        status: 'created',
        data: expect.objectContaining({
          externalApplicationId: EXTERNAL_APPLICATION_ID,
          document: expect.objectContaining({
            originalFilename: 'external-business-plan.pdf',
            mimeType: 'application/pdf',
          }),
        }),
      }),
    )
    expect(documentBody.data.document.fileSize).toBeGreaterThan(0)

    const duplicateDocumentResponse = await request.post(
      `/api/v1/integration/applications/${EXTERNAL_APPLICATION_ID}/documents`,
      {
        headers: {
          Authorization: AUTH_HEADER,
          'Idempotency-Key': documentIdempotencyKey,
        },
        multipart: {
          file: {
            name: 'external-business-plan.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('%PDF-1.4\n% external integration test pdf retry\n', 'utf8'),
          },
          docType: 'business_plan',
        },
      },
    )
    expect(duplicateDocumentResponse.status()).toBe(200)
    const duplicateDocumentBody = (await duplicateDocumentResponse.json()) as typeof documentBody
    expect(duplicateDocumentBody.status).toBe('ok')
    expect(duplicateDocumentBody.data.document.id).toBe(documentBody.data.document.id)

    const oversizedDocumentResponse = await request.post(
      `/api/v1/integration/applications/${EXTERNAL_APPLICATION_ID}/documents`,
      {
        headers: {
          Authorization: AUTH_HEADER,
          'Idempotency-Key': `${documentIdempotencyKey}-oversized`,
        },
        multipart: {
          file: {
            name: 'oversized-business-plan.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.concat([
              Buffer.from('%PDF-1.4\n', 'utf8'),
              Buffer.alloc(50 * 1024 * 1024 + 1),
            ]),
          },
          docType: 'business_plan',
        },
      },
    )
    expect(oversizedDocumentResponse.status()).toBe(422)
    expect(await oversizedDocumentResponse.json()).toEqual(
      expect.objectContaining({
        status: 'failed',
        message: 'PDF document exceeds the 50MB limit',
      }),
    )

    const resultsResponse = await request.get(
      `/api/v1/integration/sessions/${EXTERNAL_SESSION_ID}/results`,
      {
        headers: { Authorization: AUTH_HEADER },
      },
    )

    expect(resultsResponse.status()).toBe(200)
    expect(await resultsResponse.json()).toEqual(
      expect.objectContaining({
        status: 'ok',
        data: expect.objectContaining({
          externalSessionId: EXTERNAL_SESSION_ID,
          totalApplications: 1,
          results: [
            expect.objectContaining({
              externalApplicationId: EXTERNAL_APPLICATION_ID,
              companyName: 'External Company 1',
              selected: false,
            }),
          ],
        }),
      }),
    )
  })
})
