import * as XLSX from 'xlsx'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getAdminSession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'

const allowedExtensions = ['.csv', '.xlsx', '.xls'] as const

const previewQuerySchema = z.object({
  preview: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
})

const importableRowSchema = z.object({
  name: z.string().trim().min(1, '기업명은 필수입니다'),
  ceoName: z.string().trim().optional(),
  businessNumber: z.string().trim().optional(),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .email('이메일 형식이 올바르지 않습니다')
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : undefined)),
  industry: z.string().trim().optional(),
  foundedDate: z.date().optional(),
})

type ImportableRow = z.infer<typeof importableRowSchema>

type ParsedValidationResult = {
  rowNumber: number
  original: Record<string, unknown>
  mapped: Record<string, unknown>
  success: boolean
  data?: ImportableRow
  errorMessage?: string
}

const headerMap: Record<string, keyof Omit<ImportableRow, 'foundedDate'> | 'foundedDate'> = {
  기업명: 'name',
  대표자명: 'ceoName',
  사업자등록번호: 'businessNumber',
  주소: 'address',
  전화: 'phone',
  이메일: 'email',
  업종: 'industry',
  설립일: 'foundedDate',
  name: 'name',
  ceoName: 'ceoName',
  businessNumber: 'businessNumber',
  address: 'address',
  phone: 'phone',
  email: 'email',
  industry: 'industry',
  foundedDate: 'foundedDate',
}

function normalizeHeader(value: string) {
  return value.replace(/\s+/g, '').trim()
}

function cleanOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function parseFoundedDate(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return undefined
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)

    if (!parsed) {
      return undefined
    }

    return new Date(parsed.y, parsed.m - 1, parsed.d)
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(/\./g, '-').replace(/\//g, '-')
    const date = new Date(normalized)

    if (!Number.isNaN(date.getTime())) {
      return date
    }
  }

  return undefined
}

function mapRowColumns(row: Record<string, unknown>) {
  const mapped: Record<string, unknown> = {}

  for (const [rawHeader, rawValue] of Object.entries(row)) {
    const normalized = normalizeHeader(rawHeader)
    const targetField = headerMap[normalized]

    if (!targetField) {
      continue
    }

    if (targetField === 'foundedDate') {
      mapped[targetField] = parseFoundedDate(rawValue)
      continue
    }

    mapped[targetField] = cleanOptionalString(rawValue)
  }

  return mapped
}

function parseSpreadsheetRows(fileBuffer: ArrayBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    return []
  }

  const firstSheet = workbook.Sheets[firstSheetName]

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    defval: '',
    raw: false,
  })
}

function validateRows(rows: Record<string, unknown>[]) {
  const results: ParsedValidationResult[] = []

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2
    const mappedRow = mapRowColumns(row)
    const parsed = importableRowSchema.safeParse(mappedRow)

    if (!parsed.success) {
      results.push({
        rowNumber,
        original: row,
        mapped: mappedRow,
        success: false,
        errorMessage:
          parsed.error.issues[0]?.message ?? '행 데이터가 올바르지 않습니다',
      })
      continue
    }

    results.push({
      rowNumber,
      original: row,
      mapped: mappedRow,
      success: true,
      data: parsed.data,
    })
  }

  return results
}

function isAllowedFile(filename: string) {
  const lower = filename.toLowerCase()
  return allowedExtensions.some((ext) => lower.endsWith(ext))
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await getAdminSession(request)

  if (!session) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { sessionId } = await params
  const { searchParams } = new URL(request.url)

  const parsedQuery = previewQuerySchema.safeParse({
    preview: searchParams.get('preview') ?? undefined,
  })

  if (!parsedQuery.success) {
    return NextResponse.json({ error: '쿼리 파라미터가 올바르지 않습니다' }, { status: 400 })
  }

  const targetSession = await prisma.evaluationSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true },
  })

  if (!targetSession) {
    return NextResponse.json({ error: '평가 세션을 찾을 수 없습니다' }, { status: 404 })
  }

  if (!(targetSession.status === 'draft' || targetSession.status === 'open')) {
    return NextResponse.json(
      { error: '세션 상태가 draft 또는 open일 때만 가져올 수 있습니다' },
      { status: 400 },
    )
  }

  let formData: FormData

  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'multipart/form-data 요청이 필요합니다' }, { status: 400 })
  }

  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '업로드 파일이 필요합니다' }, { status: 400 })
  }

  if (!isAllowedFile(file.name)) {
    return NextResponse.json(
      { error: 'CSV(.csv) 또는 Excel(.xlsx, .xls) 파일만 업로드할 수 있습니다' },
      { status: 400 },
    )
  }

  let parsedRows: Record<string, unknown>[]

  try {
    const buffer = await file.arrayBuffer()
    parsedRows = parseSpreadsheetRows(buffer)
  } catch {
    return NextResponse.json({ error: '파일을 읽는 중 오류가 발생했습니다' }, { status: 400 })
  }

  if (parsedRows.length === 0) {
    return NextResponse.json({ error: '데이터 행이 없습니다' }, { status: 400 })
  }

  const requiredColumnExists = Object.keys(parsedRows[0] ?? {}).some(
    (header) => headerMap[normalizeHeader(header)] === 'name',
  )

  if (!requiredColumnExists) {
    return NextResponse.json(
      { error: "필수 컬럼 '기업명'이 없습니다" },
      { status: 400 },
    )
  }

  const validationResults = validateRows(parsedRows)
  const validationErrors = validationResults
    .filter((result) => !result.success)
    .map((result) => ({
      rowNumber: result.rowNumber,
      rowData: result.original,
      errorMessage: result.errorMessage ?? '검증 실패',
    }))

  if (parsedQuery.data.preview) {
    return NextResponse.json({
      batchId: null,
      totalRows: parsedRows.length,
      successCount: validationResults.filter((row) => row.success).length,
      errorCount: validationErrors.length,
      preview: validationResults.slice(0, 10).map((row) => ({
        rowNumber: row.rowNumber,
        data: row.mapped,
        valid: row.success,
        errorMessage: row.errorMessage,
      })),
      errors: validationErrors,
    })
  }

  const initialBatch = await prisma.importBatch.create({
    data: {
      filename: file.name,
      sessionId,
      importedById: session.id,
      status: 'processing',
      totalRows: parsedRows.length,
      successCount: 0,
      errorCount: 0,
    },
    select: { id: true },
  })

  const rowErrors = [...validationErrors]
  let successCount = 0

  const maxOrder = await prisma.application.aggregate({
    where: { sessionId },
    _max: { evaluationOrder: true },
  })

  let currentOrder = maxOrder._max.evaluationOrder ?? 0

  for (const result of validationResults) {
    if (!result.success || !result.data) {
      continue
    }

    try {
      const existingCompany = result.data.businessNumber
        ? await prisma.company.findFirst({
            where: { businessNumber: result.data.businessNumber },
            select: { id: true },
          })
        : null

      const company =
        existingCompany ??
        (await prisma.company.create({
          data: {
            name: result.data.name,
            ceoName: result.data.ceoName,
            businessNumber: result.data.businessNumber,
            address: result.data.address,
            phone: result.data.phone,
            email: result.data.email,
            industry: result.data.industry,
            foundedDate: result.data.foundedDate,
          },
          select: { id: true },
        }))

      const duplicateApplication = await prisma.application.findUnique({
        where: {
          sessionId_companyId: {
            sessionId,
            companyId: company.id,
          },
        },
        select: { id: true },
      })

      if (duplicateApplication) {
        rowErrors.push({
          rowNumber: result.rowNumber,
          rowData: result.original,
          errorMessage: '이미 해당 세션에 등록된 기업입니다',
        })
        continue
      }

      currentOrder += 1

      await prisma.application.create({
        data: {
          sessionId,
          companyId: company.id,
          evaluationOrder: currentOrder,
          status: 'registered',
        },
      })

      successCount += 1
    } catch {
      rowErrors.push({
        rowNumber: result.rowNumber,
        rowData: result.original,
        errorMessage: '저장 중 오류가 발생했습니다',
      })
    }
  }

  if (rowErrors.length > 0) {
    await prisma.importRowError.createMany({
      data: rowErrors.map((error) => ({
        batchId: initialBatch.id,
        rowNumber: error.rowNumber,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rowDataJson: error.rowData as any,
        errorMessage: error.errorMessage,
      })),
    })
  }

  await prisma.importBatch.update({
    where: { id: initialBatch.id },
    data: {
      status: 'completed',
      successCount,
      errorCount: rowErrors.length,
    },
  })

  return NextResponse.json({
    batchId: initialBatch.id,
    totalRows: parsedRows.length,
    successCount,
    errorCount: rowErrors.length,
    errors: rowErrors,
  })
}
