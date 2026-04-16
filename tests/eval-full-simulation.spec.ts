import { expect, test } from '@playwright/test'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Client } from 'pg'
import { execSync } from 'child_process'
import { createServer, type IncomingMessage } from 'http'

const ADMIN_EMAIL = 'testadmin@test.com'
const ADMIN_PASSWORD = 'TestAdmin123!'
const INTEGRATION_AUTH_HEADER = 'Bearer test-integration-key'

const SESSION_ID = 'sim-session-2026'
const FORM_ID = 'sim-form-2026'
const TEMPLATE_ID = 'sim-template-2026'
const TEMPLATE_VERSION_ID = 'sim-template-version-2026'

const SCORE_ITEMS = [
  { id: 'market_need', label: '시장 문제 명확성', weight: 15 },
  { id: 'business_model', label: '수익모델 실현 가능성', weight: 15 },
  { id: 'tech_edge', label: '기술 차별성', weight: 20 },
  { id: 'implementation', label: '구현 완성도', weight: 15 },
  { id: 'team_capacity', label: '팀 역량', weight: 15 },
  { id: 'growth', label: '성장 가능성', weight: 10 },
  { id: 'budget_fit', label: '자금 활용 적정성', weight: 10 },
] as const

const SIM_SCHEMA = {
  sections: [
    {
      id: 's1',
      title: '사업성',
      weight: 30,
      items: [
        radioItem('market_need', '시장 문제 명확성', 15),
        radioItem('business_model', '수익모델 실현 가능성', 15),
        textItem('business_comment', '사업성 종합 의견'),
      ],
    },
    {
      id: 's2',
      title: '기술성',
      weight: 35,
      items: [
        radioItem('tech_edge', '기술 차별성', 20),
        radioItem('implementation', '구현 완성도', 15),
        textItem('tech_comment', '기술성 종합 의견'),
      ],
    },
    {
      id: 's3',
      title: '수행역량 및 확장성',
      weight: 35,
      items: [
        radioItem('team_capacity', '팀 역량', 15),
        radioItem('growth', '성장 가능성', 10),
        radioItem('budget_fit', '자금 활용 적정성', 10),
        textItem('final_comment', '최종 추천 의견'),
      ],
    },
  ],
}

const COMPANIES = Array.from({ length: 10 }, (_, index) => {
  const ordinal = index + 1
  return {
    id: `sim-company-${ordinal}`,
    applicationId: `sim-application-${ordinal}`,
    name: `시뮬레이션 기업 ${String(ordinal).padStart(2, '0')}`,
    businessNumber: `999-88-77${String(ordinal).padStart(2, '0')}`,
    baseScore: [94, 91, 88, 84, 81, 78, 74, 70, 66, 62][index],
  }
})

const MEMBERS = Array.from({ length: 5 }, (_, index) => {
  const ordinal = index + 1
  return {
    id: `sim-member-${ordinal}`,
    name: `시뮬레이션 평가위원 ${ordinal}`,
    phone: `010-88${String(ordinal).padStart(2, '0')}-00${String(ordinal).padStart(2, '0')}`,
  }
})

function radioItem(id: string, label: string, weight: number) {
  return {
    id,
    type: 'radio_score',
    label,
    weight,
    required: true,
    options: [
      { score: 1, label: '매우 미흡' },
      { score: 2, label: '미흡' },
      { score: 3, label: '보통' },
      { score: 4, label: '우수' },
      { score: 5, label: '매우 우수' },
    ],
  }
}

function textItem(id: string, label: string) {
  return {
    id,
    type: 'text',
    label,
    required: true,
    maxLength: 1000,
  }
}

function databaseUrl() {
  return process.env.DATABASE_URL ?? 'postgresql://eval:eval_secret@localhost:15432/eval_db'
}

function storageConfig() {
  return {
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
    bucket: process.env.S3_BUCKET ?? 'eval-documents',
    region: process.env.S3_REGION ?? 'us-east-1',
  }
}

async function withDb<T>(fn: (client: Client) => Promise<T>) {
  const client = new Client({ connectionString: databaseUrl() })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

async function cleanupSimulation(client: Client) {
  await client.query('DELETE FROM signature_artifact WHERE "submissionId" LIKE $1', ['sim-submission-%'])
  await client.query('DELETE FROM evaluation_submission WHERE id LIKE $1', ['sim-submission-%'])
  await client.query('DELETE FROM evaluation_draft WHERE "sessionId" = $1', [SESSION_ID])
  await client.query('DELETE FROM result_snapshot WHERE "sessionId" = $1', [SESSION_ID])
  await client.query('DELETE FROM aggregation_run WHERE "sessionId" = $1', [SESSION_ID])
  await client.query('DELETE FROM application_document WHERE "applicationId" LIKE $1', ['sim-application-%'])
  await client.query('DELETE FROM application WHERE "sessionId" = $1', [SESSION_ID])
  await client.query('DELETE FROM session_committee_assignment WHERE "sessionId" = $1', [SESSION_ID])
  await client.query('DELETE FROM session_form_definition WHERE "sessionId" = $1', [SESSION_ID])
  await client.query('DELETE FROM evaluation_session WHERE id = $1', [SESSION_ID])
  await client.query('DELETE FROM company WHERE id LIKE $1', ['sim-company-%'])
  await client.query('DELETE FROM committee_member WHERE id LIKE $1', ['sim-member-%'])
  await client.query('DELETE FROM form_template_version WHERE id = $1', [TEMPLATE_VERSION_ID])
  await client.query('DELETE FROM form_template WHERE id = $1', [TEMPLATE_ID])
}

async function uploadSimulationPdf() {
  const config = storageConfig()
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })

  const pdf = Buffer.from(
    `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >>
>>
endobj
4 0 obj
<< /Length 68 >>
stream
BT
/F1 20 Tf
72 720 Td
(Simulation Business Plan) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000265 00000 n
0000000383 00000 n
trailer
<< /Root 1 0 R /Size 6 >>
startxref
453
%%EOF`,
    'utf8',
  )

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: simulationDocumentKey(COMPANIES[0].applicationId),
      Body: pdf,
      ContentType: 'application/pdf',
    }),
  )

  return pdf.length
}

function simulationDocumentKey(applicationId: string) {
  return `sessions/${SESSION_ID}/applications/${applicationId}/documents/simulation-business-plan.pdf`
}

function buildAnswers(companyIndex: number, memberIndex: number) {
  const company = COMPANIES[companyIndex]
  const evaluatorAdjustment = [-2, -1, 0, 1, 2][memberIndex]
  const normalized = Number(
    Math.max(1, Math.min(5, (company.baseScore + evaluatorAdjustment) / 20)).toFixed(2),
  )
  return {
    market_need: normalized,
    business_model: normalized,
    tech_edge: normalized,
    implementation: normalized,
    team_capacity: normalized,
    growth: normalized,
    budget_fit: normalized,
    business_comment: `${company.name} 사업성 검토 완료`,
    tech_comment: `${company.name} 기술성 검토 완료`,
    final_comment: `${company.name} 최종 검토 완료`,
  }
}

function buildScoreDetails(answers: Record<string, string | number>) {
  const perItem: Record<string, { rawScore: number; weightedScore: number; maxScore: number }> = {}
  let totalScore = 0

  for (const item of SCORE_ITEMS) {
    const rawScore = Number(answers[item.id])
    const weightedScore = (rawScore / 5) * item.weight
    perItem[item.id] = {
      rawScore,
      weightedScore,
      maxScore: item.weight,
    }
    totalScore += weightedScore
  }

  return {
    perItem,
    perSection: {},
    totalScore,
    maxScore: 100,
  }
}

async function seedSimulation() {
  const uploadedPdfSize = await uploadSimulationPdf()
  clearSimulationOtpState()

  await withDb(async (client) => {
    await cleanupSimulation(client)

    const admin = await client.query<{ id: string }>(
      'SELECT id FROM admin_user WHERE email = $1 LIMIT 1',
      [ADMIN_EMAIL],
    )
    const adminId = admin.rows[0]?.id
    if (!adminId) throw new Error('Admin user not found')

    await client.query(
      `INSERT INTO form_template (id, name, description, "isShared", "createdAt", "createdById")
       VALUES ($1, $2, $3, TRUE, NOW(), $4)`,
      [TEMPLATE_ID, '시뮬레이션 평가표', '전 과정 시뮬레이션용 100점 평가표', adminId],
    )
    await client.query(
      `INSERT INTO form_template_version
        (id, "versionNumber", "schemaJson", "totalScore", "itemsCount", "createdAt", "templateId")
       VALUES ($1, 1, $2::jsonb, 100, 10, NOW(), $3)`,
      [TEMPLATE_VERSION_ID, JSON.stringify(SIM_SCHEMA), TEMPLATE_ID],
    )
    await client.query(
      `INSERT INTO evaluation_session
        (id, title, description, status, "committeeSize", "trimRule", "createdAt", "openedAt", "closedAt", "createdById")
       VALUES ($1, $2, $3, 'closed', 5, 'exclude_min_max', NOW(), NOW(), NOW(), $4)`,
      [SESSION_ID, '2026 시뮬레이션 지원사업', '신청기업 10개 중 상위 3개 선정 시뮬레이션', adminId],
    )
    await client.query(
      `INSERT INTO session_form_definition
        (id, "schemaJson", "totalScore", "itemsCount", "snapshotAt", "createdAt", "sessionId", "formTemplateVersionId")
       VALUES ($1, $2::jsonb, 100, 10, NOW(), NOW(), $3, $4)`,
      [FORM_ID, JSON.stringify(SIM_SCHEMA), SESSION_ID, TEMPLATE_VERSION_ID],
    )

    for (const company of COMPANIES) {
      await client.query(
        `INSERT INTO company
          (id, name, "ceoName", "businessNumber", address, phone, email, industry, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          company.id,
          company.name,
          `대표 ${company.name.slice(-2)}`,
          company.businessNumber,
          '서울특별시 테스트구',
          '02-1234-5678',
          `${company.id}@example.test`,
          'AI/SaaS',
        ],
      )
      await client.query(
        `INSERT INTO application
          (id, "evaluationOrder", status, notes, "createdAt", "sessionId", "companyId")
         VALUES ($1, $2, 'registered', $3, NOW(), $4, $5)`,
        [company.applicationId, Number(company.applicationId.split('-').at(-1)), '시뮬레이션 신청', SESSION_ID, company.id],
      )
    }

    await client.query(
      `INSERT INTO application_document
        (id, "docType", "storageKey", "originalFilename", "mimeType", "fileSize", "uploadedAt", "applicationId", "uploadedBy")
       VALUES ($1, 'business_plan', $2, $3, 'application/pdf', $4, NOW(), $5, $6)`,
      [
        'sim-document-1',
        simulationDocumentKey(COMPANIES[0].applicationId),
        'simulation-business-plan.pdf',
        uploadedPdfSize,
        COMPANIES[0].applicationId,
        adminId,
      ],
    )

    for (const [memberIndex, member] of MEMBERS.entries()) {
      await client.query(
        `INSERT INTO committee_member
          (id, name, phone, organization, position, field, "isActive", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())`,
        [member.id, member.name, member.phone, '시뮬레이션 평가단', '전문위원', '사업/기술'],
      )
      await client.query(
        `INSERT INTO session_committee_assignment
          (id, role, "assignedAt", "sessionId", "committeeMemberId")
         VALUES ($1, $2, NOW(), $3, $4)`,
        [`sim-assignment-${memberIndex + 1}`, memberIndex === 0 ? 'chair' : 'member', SESSION_ID, member.id],
      )
    }

    for (const [companyIndex, company] of COMPANIES.entries()) {
      for (const [memberIndex, member] of MEMBERS.entries()) {
        const answers = buildAnswers(companyIndex, memberIndex)
        const scores = buildScoreDetails(answers)
        const submissionId = `sim-submission-${companyIndex + 1}-${memberIndex + 1}`
        await client.query(
          `INSERT INTO evaluation_submission
            (id, "submissionState", "answersJson", "scoresJson", "totalScore", "isValid", "submittedAt", "signedAt", "createdAt", "applicationId", "committeeMemberId", "sessionId", "formSnapshotId")
           VALUES ($1, 'signed', $2::jsonb, $3::jsonb, $4, TRUE, NOW(), NOW(), NOW(), $5, $6, $7, $8)`,
          [
            submissionId,
            JSON.stringify(answers),
            JSON.stringify(scores),
            scores.totalScore,
            company.applicationId,
            member.id,
            SESSION_ID,
            FORM_ID,
          ],
        )
        await client.query(
          `INSERT INTO signature_artifact
            (id, "signatureImageStorageKey", "otpVerified", "otpPhone", "canonicalJsonHash", "signerName", "signedAt", "serverSeal", "serverSealAlgorithm", "createdAt", "submissionId")
           VALUES ($1, $2, TRUE, $3, $4, $5, NOW(), $6, 'HMAC-SHA256', NOW(), $7)`,
          [
            `sim-signature-${companyIndex + 1}-${memberIndex + 1}`,
            `signatures/${SESSION_ID}/${submissionId}.png`,
            member.phone,
            `hash-${submissionId}`,
            member.name,
            `seal-${submissionId}`,
            submissionId,
          ],
        )
      }
    }
  })
}

function clearSimulationOtpState() {
  for (const member of MEMBERS) {
    const normalized = member.phone.replace(/\D/g, '')
    try {
      execSync(
        `docker exec eval-redis-1 redis-cli -p 6379 DEL "otp:${normalized}" "otp:rate:${normalized}"`,
      )
    } catch {
      // The test will fail at OTP request if Redis is unavailable.
    }
  }
}

async function startWebhookReceiver() {
  const deliveries: Array<{
    body: unknown
    eventId: string | undefined
    signature: string | undefined
  }> = []
  const server = createServer((request: IncomingMessage, response) => {
    if (request.method !== 'POST' || request.url !== '/integration-webhook') {
      response.writeHead(404)
      response.end()
      return
    }

    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8')
      deliveries.push({
        body: JSON.parse(body),
        eventId: request.headers['x-event-id'] as string | undefined,
        signature: request.headers['x-signature'] as string | undefined,
      })
      if (deliveries.length === 1) {
        response.writeHead(500, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ ok: false, retry: true }))
        return
      }
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ ok: true }))
    })
  })

  await new Promise<void>((resolve) => server.listen(3999, '127.0.0.1', resolve))

  return {
    deliveries,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

test('simulates 5 evaluators scoring 10 companies and verifies evaluator document UI plus top 3 selection', async ({
  page,
  request,
}) => {
  await seedSimulation()

  const firstMember = MEMBERS[0]
  const otpResponse = await page.request.post('/api/eval/auth/request-otp', {
    data: { name: firstMember.name, phone: firstMember.phone },
  })
  expect(otpResponse.ok()).toBeTruthy()
  const otpBody = (await otpResponse.json()) as { code: string }

  const verifyResponse = await page.request.post('/api/eval/auth/verify-otp', {
    data: { name: firstMember.name, phone: firstMember.phone, code: otpBody.code },
  })
  expect(verifyResponse.ok()).toBeTruthy()

  await page.goto(`/eval/sessions/${SESSION_ID}`)
  await expect(page.getByText(COMPANIES[0].name)).toBeVisible()
  await page.getByText(COMPANIES[0].name).click()
  await expect(page).toHaveURL(new RegExp(`/eval/sessions/${SESSION_ID}/evaluate/${COMPANIES[0].applicationId}`))
  await expect(page.getByRole('heading', { name: COMPANIES[0].name })).toBeVisible()
  await expect(page.getByText('simulation-business-plan.pdf').first()).toBeVisible()
  await expect(page.getByText('작성 10/10').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'simulation-business-plan.pdf' })).toBeVisible()
  await page.getByRole('button', { name: 'simulation-business-plan.pdf' }).click()
  await expect(page.getByText('/ 1')).toHaveCount(1, { timeout: 10000 })
  await expect(page.getByText('시장 문제 명확성').first()).toBeVisible()
  await expect(page.getByText('배점 15').first()).toBeVisible()
  await expect(page.getByText(`${COMPANIES[0].name} 사업성 검토 완료`).first()).toBeVisible()
  await expect(page.getByLabel('사업성 종합 의견').first()).toBeDisabled()
  await expect(page.getByLabel('매우 우수').first()).toBeDisabled()
  await expect(page.getByRole('button', { name: '최종 제출' }).first()).toBeDisabled()

  const login = await request.post('/api/admin/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  expect(login.ok()).toBeTruthy()

  const aggregate = await request.post(`/api/admin/sessions/${SESSION_ID}/aggregate`)
  expect(aggregate.ok()).toBeTruthy()
  const aggregateBody = (await aggregate.json()) as {
    results: { companyName: string; finalScore: number | null; rank: number | null; error: string | null }[]
  }
  const selected = aggregateBody.results.filter((result) => result.rank !== null && result.rank <= 3)
  expect(selected.map((result) => result.companyName)).toEqual([
    COMPANIES[0].name,
    COMPANIES[1].name,
    COMPANIES[2].name,
  ])
  expect(aggregateBody.results.every((result) => result.error === null)).toBeTruthy()

  const webhookReceiver = await startWebhookReceiver()
  try {
    const finalize = await request.post(`/api/admin/sessions/${SESSION_ID}/status`, {
      data: { status: 'finalized', reason: '시뮬레이션 최종 선정 확정' },
    })
    expect(finalize.ok()).toBeTruthy()
    await expect.poll(() => webhookReceiver.deliveries.length).toBe(2)
    expect(webhookReceiver.deliveries[0].eventId).toBe(webhookReceiver.deliveries[1].eventId)
    expect(webhookReceiver.deliveries[1].eventId).toMatch(/^evaluation\.finalized:/)
    expect(webhookReceiver.deliveries[1].signature).toMatch(/^sha256=/)
    expect(webhookReceiver.deliveries[1].body).toEqual(
      expect.objectContaining({
        eventId: webhookReceiver.deliveries[1].eventId,
        event: 'evaluation.finalized',
        sessionId: SESSION_ID,
        selectedApplications: [
          expect.objectContaining({ companyName: COMPANIES[0].name, rank: 1 }),
          expect.objectContaining({ companyName: COMPANIES[1].name, rank: 2 }),
          expect.objectContaining({ companyName: COMPANIES[2].name, rank: 3 }),
        ],
      }),
    )
    await withDb(async (client) => {
      const delivery = await client.query<{
        status: string
        attempts: number
      }>(
        'SELECT status, attempts FROM integration_webhook_delivery WHERE event_id = $1',
        [webhookReceiver.deliveries[1].eventId],
      )
      expect(delivery.rows[0]).toEqual({ status: 'delivered', attempts: 2 })
    })

    const replay = await request.post(
      `/api/v1/integration/webhooks/${encodeURIComponent(webhookReceiver.deliveries[1].eventId!)}/replay`,
      {
        headers: { Authorization: INTEGRATION_AUTH_HEADER },
      },
    )
    expect(replay.ok()).toBeTruthy()
    await expect.poll(() => webhookReceiver.deliveries.length).toBe(3)
    expect(webhookReceiver.deliveries[2].eventId).toBe(webhookReceiver.deliveries[1].eventId)
  } finally {
    await webhookReceiver.close()
  }

  const pdfExport = await request.get(`/api/admin/sessions/${SESSION_ID}/results/pdf`)
  expect(pdfExport.ok()).toBeTruthy()
  expect(pdfExport.headers()['content-type']).toContain('application/pdf')
  expect((await pdfExport.body()).byteLength).toBeGreaterThan(1000)

  const excelExport = await request.get(`/api/admin/sessions/${SESSION_ID}/results/excel`)
  expect(excelExport.ok()).toBeTruthy()
  expect(excelExport.headers()['content-type']).toContain(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  expect((await excelExport.body()).byteLength).toBeGreaterThan(1000)

  await withDb(async (client) => {
    const counts = await client.query<{
      submissions: string
      snapshots: string
      selected: string
    }>(
      `SELECT
        (SELECT COUNT(*)::text FROM evaluation_submission WHERE "sessionId" = $1 AND "submissionState" = 'signed') AS submissions,
        (SELECT COUNT(*)::text FROM result_snapshot WHERE "sessionId" = $1) AS snapshots,
        (SELECT COUNT(*)::text FROM result_snapshot WHERE "sessionId" = $1 AND rank <= 3) AS selected`,
      [SESSION_ID],
    )

    expect(counts.rows[0]).toEqual({
      submissions: '50',
      snapshots: '10',
      selected: '3',
    })
  })
})
