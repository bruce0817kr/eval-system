import { NextResponse } from 'next/server'

import { getAdminSession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'
import { getFileUrl } from '@/lib/storage'

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      sessionId: string
      applicationId: string
      documentId: string
    }>
  },
) {
  const admin = await getAdminSession(request)
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { sessionId, applicationId, documentId } = await params

  const application = await prisma.application.findFirst({
    where: { id: applicationId, sessionId },
    select: { id: true },
  })

  if (!application) {
    return NextResponse.json({ error: '신청 정보를 찾을 수 없습니다' }, { status: 404 })
  }

  const document = await prisma.applicationDocument.findFirst({
    where: { id: documentId, applicationId },
  })

  if (!document) {
    return NextResponse.json({ error: '문서를 찾을 수 없습니다' }, { status: 404 })
  }

  const url = await getFileUrl(document.storageKey)

  return NextResponse.json({
    url,
    originalFilename: document.originalFilename,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
  })
}
