import { execFileSync } from 'child_process'
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

const config = {
  databaseUrl: process.env.DATABASE_URL || 'postgresql://eval:eval_secret@localhost:5433/eval_db',
  s3Endpoint: process.env.S3_ENDPOINT || 'http://localhost:9002',
  s3AccessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
  s3SecretKey: process.env.S3_SECRET_KEY || 'minioadmin',
  s3Bucket: process.env.S3_BUCKET || 'eval-documents',
  s3Region: process.env.S3_REGION || 'us-east-1',
}

const testData = {
  member: {
    id: 'test-member-e2e',
    name: '김평가',
    phone: '01022222222',
    organization: '테스트대학',
    position: '교수',
    field: '컴퓨터공학',
  },
  company: {
    id: 'test-company-e2e',
    name: '(주)테스트기업',
    ceoName: '홍길동',
    businessNumber: '123-45-67890',
    address: '서울시 강남구',
    industry: 'IT',
  },
  session: {
    id: 'test-session-e2e',
    title: '2024년 혁신기업 평가',
    description: 'E2E 테스트용 평가 회차',
    committeeSize: 3,
  },
}

const s3Client = new S3Client({
  endpoint: config.s3Endpoint,
  region: config.s3Region,
  credentials: {
    accessKeyId: config.s3AccessKey,
    secretAccessKey: config.s3SecretKey,
  },
  forcePathStyle: true,
})

function execPrisma(query) {
  return execFileSync(
    'docker',
    ['exec', 'eval-postgres', 'psql', '-U', 'eval', '-d', 'eval_db', '-v', 'ON_ERROR_STOP=1', '-c', query],
    { encoding: 'utf8' },
  )
}

function checkPrismaConnection() {
  try {
    execFileSync('docker', ['exec', 'eval-postgres', 'psql', '-U', 'eval', '-d', 'eval_db', '-c', 'SELECT 1;'], {
      encoding: 'utf8',
    })
    return true
  } catch {
    return false
  }
}

async function checkS3Connection() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: config.s3Bucket }))
    return true
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode
    if (status === 404) {
      await s3Client.send(new CreateBucketCommand({ Bucket: config.s3Bucket }))
      return true
    }

    return false
  }
}

function createMinimalPDF() {
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 178 >>
stream
BT
/F1 24 Tf
100 700 Td
(E2E Test PDF) Tj
0 -30 Td
/F1 12 Tf
(This is a test document for E2E testing.) Tj
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
0000000266 00000 n
0000000496 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
573
%%EOF`

  return Buffer.from(pdfContent, 'utf8')
}

async function uploadPDFToS3(pdfBuffer, sessionId, applicationId, filename) {
  const storageKey = `sessions/${sessionId}/applications/${applicationId}/documents/${Date.now()}-${filename}`

  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: storageKey,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    }),
  )

  return storageKey
}

async function setupTestData() {
  console.log('\n=== E2E 테스트 데이터 설정 ===\n')

  console.log('1. 연결 확인...')
  const dbOk = checkPrismaConnection()
  const s3Ok = await checkS3Connection()
  console.log(`   PostgreSQL: ${dbOk ? '✅ 연결됨' : '❌ 연결 실패'}`)
  console.log(`   MinIO S3: ${s3Ok ? '✅ 연결됨' : '❌ 연결 실패'}`)

  if (!dbOk) {
    console.error('   PostgreSQL에 연결할 수 없습니다. Docker가 실행 중인지 확인하세요.')
    process.exit(1)
  }

  console.log('\n2. 기존 테스트 데이터 정리...')
  execPrisma(`DELETE FROM signature_artifact WHERE "submissionId" IN (SELECT id FROM evaluation_submission WHERE "committeeMemberId" = '${testData.member.id}' OR "sessionId" = '${testData.session.id}')`)
  execPrisma(`DELETE FROM evaluation_draft WHERE "committeeMemberId" = '${testData.member.id}' OR "sessionId" = '${testData.session.id}'`)
  execPrisma(`DELETE FROM evaluation_submission WHERE "committeeMemberId" = '${testData.member.id}' OR "sessionId" = '${testData.session.id}'`)
  execPrisma(`DELETE FROM result_snapshot WHERE "sessionId" = '${testData.session.id}'`)
  execPrisma(`DELETE FROM application_document WHERE "applicationId" IN (SELECT id FROM application WHERE "sessionId" = '${testData.session.id}')`)
  execPrisma(`DELETE FROM application WHERE "sessionId" = '${testData.session.id}'`)
  execPrisma(`DELETE FROM company WHERE id = '${testData.company.id}'`)
  execPrisma(`DELETE FROM session_committee_assignment WHERE "sessionId" = '${testData.session.id}'`)
  execPrisma(`DELETE FROM session_form_definition WHERE "sessionId" = '${testData.session.id}'`)
  execPrisma(`DELETE FROM aggregation_run WHERE "sessionId" = '${testData.session.id}'`)
  execPrisma(`DELETE FROM audit_event WHERE "sessionId" = '${testData.session.id}'`)
  execPrisma(`DELETE FROM evaluation_session WHERE id = '${testData.session.id}'`)
  execPrisma(`DELETE FROM committee_member WHERE id = '${testData.member.id}'`)

  console.log('\n3. 평가위원 생성...')
  execPrisma(`
    INSERT INTO committee_member (id, name, phone, organization, position, field, "isActive", "createdAt")
    VALUES ('${testData.member.id}', '${testData.member.name}', '${testData.member.phone}', '${testData.member.organization}', '${testData.member.position}', '${testData.member.field}', true, NOW())
    RETURNING id
  `)
  console.log(`   ✅ 평가위원 생성: ${testData.member.name} (${testData.member.phone})`)

  console.log('\n4. 기업 생성...')
  execPrisma(`
    INSERT INTO company (id, name, "ceoName", "businessNumber", address, industry, "createdAt")
    VALUES ('${testData.company.id}', '${testData.company.name}', '${testData.company.ceoName}', '${testData.company.businessNumber}', '${testData.company.address}', '${testData.company.industry}', NOW())
  `)
  console.log(`   ✅ 기업 생성: ${testData.company.name}`)

  console.log('\n5. 평가 회차 생성...')
  execPrisma(`
    INSERT INTO evaluation_session (id, title, description, status, "committeeSize", "trimRule", "createdAt")
    VALUES ('${testData.session.id}', '${testData.session.title}', '${testData.session.description}', 'open', ${testData.session.committeeSize}, 'exclude_min_max', NOW())
  `)
  console.log(`   ✅ 평가 회차 생성: ${testData.session.title}`)

  console.log('\n6. 평가위원 배정...')
  execPrisma(`
    INSERT INTO session_committee_assignment (id, "sessionId", "committeeMemberId", role, "assignedAt")
    VALUES ('assignment-${testData.session.id}', '${testData.session.id}', '${testData.member.id}', 'member', NOW())
  `)
  console.log(`   ✅ 평가위원 배정`)

  console.log('\n7. 평가표 설정...')
  const formSchema = {
    sections: [
      {
        id: 'section-1',
        title: '사업성 평가',
        items: [
          { id: 'item-1', type: 'radio_score', label: '기술 혁신 능력', weight: 30, options: [{ value: 5, label: '매우 우수', score: 5 }, { value: 4, label: '우수', score: 4 }, { value: 3, label: '보통', score: 3 }, { value: 2, label: '미흡', score: 2 }, { value: 1, label: '매우 미흡', score: 1 }] },
          { id: 'item-2', type: 'radio_score', label: '시장 성장 가능성', weight: 30, options: [{ value: 5, label: '매우 우수', score: 5 }, { value: 4, label: '우수', score: 4 }, { value: 3, label: '보통', score: 3 }, { value: 2, label: '미흡', score: 2 }, { value: 1, label: '매우 미흡', score: 1 }] },
          { id: 'item-3', type: 'text', label: '기타 의견', weight: 0 },
        ],
      },
      {
        id: 'section-2',
        title: '종합 평가',
        items: [
          { id: 'item-4', type: 'radio_score', label: '종합 점수', weight: 40, options: [{ value: 5, label: '매우 우수', score: 5 }, { value: 4, label: '우수', score: 4 }, { value: 3, label: '보통', score: 3 }, { value: 2, label: '미흡', score: 2 }, { value: 1, label: '매우 미흡', score: 1 }] },
        ],
      },
    ],
  }
  const schemaJson = JSON.stringify(formSchema).replace(/'/g, "''")
  execPrisma(`
    INSERT INTO session_form_definition (id, "sessionId", "schemaJson", "totalScore", "itemsCount", "snapshotAt", "createdAt")
    VALUES ('form-def-${testData.session.id}', '${testData.session.id}', '${schemaJson}', 100, 4, NOW(), NOW())
  `)
  console.log(`   ✅ 평가표 설정: 4개 항목`)

  console.log('\n8. 신청 생성...')
  execPrisma(`
    INSERT INTO application (id, "sessionId", "companyId", status, "evaluationOrder", "createdAt")
    VALUES ('app-${testData.session.id}', '${testData.session.id}', '${testData.company.id}', 'registered', 1, NOW())
  `)
  console.log(`   ✅ 신청 생성`)

  console.log('\n9. 테스트 PDF 생성 및 업로드...')
  if (s3Ok) {
    const pdfBuffer = createMinimalPDF()
    const storageKey = await uploadPDFToS3(
      pdfBuffer,
      testData.session.id,
      `app-${testData.session.id}`,
      'test-document.pdf',
    )

    execPrisma(`
      INSERT INTO application_document (id, "applicationId", "docType", "storageKey", "originalFilename", "mimeType", "fileSize", "uploadedAt")
      VALUES ('doc-${testData.session.id}', 'app-${testData.session.id}', 'business_plan', '${storageKey}', 'test-document.pdf', 'application/pdf', ${pdfBuffer.length}, NOW())
    `)
    console.log(`   ✅ PDF 업로드: ${storageKey}`)
  } else {
    console.log(`   ⏭️ S3 연결 안됨 - PDF 업로드 스킵`)
  }

  console.log('\n=== 테스트 데이터 설정 완료 ===')
  console.log('\n테스트용 평가위원 정보:')
  console.log(`  이름: ${testData.member.name}`)
  console.log(`  전화번호: ${testData.member.phone}`)
  console.log(`  ID: ${testData.member.id}`)
  console.log('\n평가 세션:')
  console.log(`  ID: ${testData.session.id}`)
  console.log(`  제목: ${testData.session.title}`)
  console.log('\n')
}

setupTestData().catch(console.error)
