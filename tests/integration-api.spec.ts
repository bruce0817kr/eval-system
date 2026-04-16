import { expect, test } from '@playwright/test'

const API_KEY = 'test-integration-key'
const AUTH_HEADER = `Bearer ${API_KEY}`
const EXTERNAL_SESSION_ID = 'external-session-restapi'
const EXTERNAL_APPLICATION_ID = 'external-application-restapi-1'

test.describe('business-management integration REST API', () => {
  test('rejects requests without bearer token', async ({ request }) => {
    const response = await request.put('/api/v1/integration/sessions/external-auth-check', {
      data: {
        title: '인증 확인용 평가',
      },
    })

    expect(response.status()).toBe(401)
    expect(await response.json()).toEqual({
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid integration bearer token',
    })
  })

  test('upserts a session and applications, then exposes integration results', async ({
    request,
  }) => {
    const sessionResponse = await request.put(
      `/api/v1/integration/sessions/${EXTERNAL_SESSION_ID}`,
      {
        headers: { Authorization: AUTH_HEADER },
        data: {
          title: '외부 연동 지원사업',
          description: '사업관리 시스템 연동 테스트',
          committeeSize: 5,
          trimRule: 'exclude_min_max',
        },
      },
    )

    expect(sessionResponse.status()).toBe(200)
    expect(await sessionResponse.json()).toEqual(
      expect.objectContaining({
        externalSessionId: EXTERNAL_SESSION_ID,
        title: '외부 연동 지원사업',
        status: 'draft',
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
                name: '외부 연동 기업 1',
                businessNumber: '777-66-55001',
                ceoName: '연동대표',
                phone: '02-1111-2222',
                email: 'integration-company-1@example.test',
                address: '서울특별시 연동구',
                industry: 'AI',
              },
              evaluationOrder: 1,
              notes: '사업관리 시스템에서 동기화',
            },
          ],
        },
      },
    )

    expect(applicationsResponse.status()).toBe(200)
    expect(await applicationsResponse.json()).toEqual(
      expect.objectContaining({
        externalSessionId: EXTERNAL_SESSION_ID,
        upsertedCount: 1,
        applications: [
          expect.objectContaining({
            externalApplicationId: EXTERNAL_APPLICATION_ID,
            companyName: '외부 연동 기업 1',
          }),
        ],
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
        externalSessionId: EXTERNAL_SESSION_ID,
        totalApplications: 1,
        results: [
          expect.objectContaining({
            externalApplicationId: EXTERNAL_APPLICATION_ID,
            companyName: '외부 연동 기업 1',
            selected: false,
          }),
        ],
      }),
    )
  })
})
