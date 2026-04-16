import { NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { uploadFile } from '@/lib/storage'
import {
  integrationError,
  integrationUnauthorized,
  verifyIntegrationRequest,
} from '@/lib/integration/auth'

const docTypeSchema = z.enum(['business_plan', 'supplementary']).default('business_plan')

type RouteContext = {
  params: Promise<{ externalApplicationId: string }>
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function POST(request: Request, context: RouteContext) {
  if (!verifyIntegrationRequest(request)) {
    return integrationUnauthorized()
  }

  const { externalApplicationId } = await context.params
  const application = await prisma.application.findUnique({
    where: { id: externalApplicationId },
    select: { id: true, sessionId: true },
  })

  if (!application) {
    return integrationError('APPLICATION_NOT_FOUND', 'Integration application not found', 404)
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return integrationError('INVALID_FORM_DATA', 'Request must be multipart/form-data', 400)
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return integrationError('FILE_REQUIRED', 'Multipart field `file` is required', 400)
  }

  const parsedDocType = docTypeSchema.safeParse(formData.get('docType') ?? undefined)
  if (!parsedDocType.success) {
    return integrationError('VALIDATION_ERROR', 'Document type is invalid', 400)
  }

  const isPdf =
    file.type === 'application/pdf' ||
    file.type === 'application/x-pdf' ||
    file.name.toLowerCase().endsWith('.pdf')

  if (!isPdf) {
    return integrationError('UNSUPPORTED_FILE_TYPE', 'Only PDF documents are supported', 400)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const storageKey = `sessions/${application.sessionId}/applications/${application.id}/documents/${Date.now()}-${sanitizeFilename(file.name)}`

  await uploadFile(storageKey, buffer, file.type || 'application/pdf')

  const document = await prisma.applicationDocument.create({
    data: {
      applicationId: application.id,
      docType: parsedDocType.data,
      storageKey,
      originalFilename: file.name,
      mimeType: file.type || 'application/pdf',
      fileSize: buffer.length,
    },
  })

  return NextResponse.json(
    {
      externalApplicationId: application.id,
      document: {
        id: document.id,
        docType: document.docType,
        originalFilename: document.originalFilename,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        uploadedAt: document.uploadedAt.toISOString(),
      },
    },
    { status: 201 },
  )
}
