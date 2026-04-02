import { NextResponse } from 'next/server'

import { getAdminSession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; batchId: string }> },
) {
  const session = await getAdminSession(request)

  if (!session) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { sessionId, batchId } = await params

  const batch = await prisma.importBatch.findFirst({
    where: {
      id: batchId,
      sessionId,
    },
    include: {
      errors: {
        orderBy: { rowNumber: 'asc' },
      },
    },
  })

  if (!batch) {
    return NextResponse.json({ error: '가져오기 배치를 찾을 수 없습니다' }, { status: 404 })
  }

  return NextResponse.json({
    batch: {
      id: batch.id,
      filename: batch.filename,
      totalRows: batch.totalRows,
      successCount: batch.successCount,
      errorCount: batch.errorCount,
      status: batch.status,
      importedAt: batch.importedAt,
      sessionId: batch.sessionId,
      importedById: batch.importedById,
    },
    errors: batch.errors.map((error) => ({
      id: error.id,
      rowNumber: error.rowNumber,
      rowDataJson: error.rowDataJson,
      errorMessage: error.errorMessage,
    })),
  })
}
