import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getAdminSession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'
import { deleteFile, uploadFile } from '@/lib/storage'

const uploadSchema = z.object({
  docType: z.enum(['business_plan', 'supplementary']).optional().default('business_plan'),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; applicationId: string }> },
) {
  const admin = await getAdminSession(request)

  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { sessionId, applicationId } = await params

  const application = await prisma.application.findFirst({
    where: { id: applicationId, sessionId },
    select: { id: true },
  })

  if (!application) {
    return NextResponse.json({ error: '신청 정보를 찾을 수 없습니다' }, { status: 404 })
  }

  let formData: FormData

  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'multipart/form-data 요청이 필요합니다' }, { status: 400 })
  }

  const file = formData.get('file')
  const docTypeValue = formData.get('docType')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '파일이 필요합니다' }, { status: 400 })
  }

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: '파일 크기는 50MB를 초과할 수 없습니다' }, { status: 400 })
  }

  const allowedTypes = ['application/pdf', 'application/x-pdf']
  const allowedExtensions = ['.pdf']
  const hasValidType = allowedTypes.includes(file.type) || file.name.toLowerCase().endsWith('.pdf')

  if (!hasValidType) {
    return NextResponse.json({ error: 'PDF 파일만 업로드할 수 있습니다' }, { status: 400 })
  }

  let parsedDocType: 'business_plan' | 'supplementary' = 'business_plan'

  if (docTypeValue && typeof docTypeValue === 'string') {
    const parseResult = uploadSchema.shape.docType.safeParse(docTypeValue)
    if (parseResult.success) {
      parsedDocType = parseResult.data
    }
  }

  const timestamp = Date.now()
  const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const storageKey = `sessions/${sessionId}/applications/${applicationId}/documents/${timestamp}-${safeFilename}`

  const buffer = Buffer.from(await file.arrayBuffer())
  await uploadFile(storageKey, buffer, file.type || 'application/pdf')

  const document = await prisma.applicationDocument.create({
    data: {
      applicationId,
      docType: parsedDocType,
      storageKey,
      originalFilename: file.name,
      mimeType: file.type || 'application/pdf',
      fileSize: file.size,
      uploadedBy: admin.id,
    },
  })

  try {
    await prisma.auditEvent.create({
      data: {
        actorType: 'admin',
        actorId: admin.id,
        action: 'create',
        targetType: 'ApplicationDocument',
        targetId: document.id,
        sessionId,
        ipAddress:
          request.headers.get('x-forwarded-for') ??
          request.headers.get('x-real-ip') ??
          null,
      },
    })
  } catch (e) {
    console.error('Audit log failed:', e)
  }

  return NextResponse.json(
    {
      id: document.id,
      docType: document.docType,
      originalFilename: document.originalFilename,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      uploadedAt: document.uploadedAt,
    },
    { status: 201 },
  )
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; applicationId: string }> },
) {
  const admin = await getAdminSession(request)

  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { sessionId, applicationId } = await params

  const application = await prisma.application.findFirst({
    where: { id: applicationId, sessionId },
    select: { id: true },
  })

  if (!application) {
    return NextResponse.json({ error: '신청 정보를 찾을 수 없습니다' }, { status: 404 })
  }

  const documents = await prisma.applicationDocument.findMany({
    where: { applicationId },
    orderBy: { uploadedAt: 'desc' },
    select: {
      id: true,
      docType: true,
      originalFilename: true,
      mimeType: true,
      fileSize: true,
      uploadedAt: true,
      uploadedBy: true,
    },
  })

  return NextResponse.json({ documents })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; applicationId: string }> },
) {
  const admin = await getAdminSession(request)

  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const documentId = searchParams.get('documentId')

  if (!documentId) {
    return NextResponse.json({ error: 'documentId가 필요합니다' }, { status: 400 })
  }

  const { sessionId, applicationId } = await params

  const document = await prisma.applicationDocument.findFirst({
    where: { id: documentId, applicationId },
  })

  if (!document) {
    return NextResponse.json({ error: '문서를 찾을 수 없습니다' }, { status: 404 })
  }

  await prisma.applicationDocument.delete({ where: { id: documentId } })

  try {
    await deleteFile(document.storageKey)
  } catch {
    // 스토리지 삭제 실패해도 DB는 이미 삭제됨 — 로그만 남김
    console.error('Storage delete failed for key:', document.storageKey)
  }

  try {
    await prisma.auditEvent.create({
      data: {
        actorType: 'admin',
        actorId: admin.id,
        action: 'delete',
        targetType: 'ApplicationDocument',
        targetId: documentId,
        sessionId,
        ipAddress:
          request.headers.get('x-forwarded-for') ??
          request.headers.get('x-real-ip') ??
          null,
      },
    })
  } catch (e) {
    console.error('Audit log failed:', e)
  }

  return NextResponse.json({ ok: true })
}
