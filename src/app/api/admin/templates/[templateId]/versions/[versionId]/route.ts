import { NextResponse } from 'next/server'

import { getAdminSession } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'

function unauthorized() {
  return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
}

export async function GET(
  request: Request,
  context: { params: Promise<{ templateId: string; versionId: string }> },
) {
  const adminSession = await getAdminSession(request)

  if (!adminSession) {
    return unauthorized()
  }

  const { templateId, versionId } = await context.params
  const version = await prisma.formTemplateVersion.findFirst({
    where: {
      id: versionId,
      templateId,
    },
  })

  if (!version) {
    return NextResponse.json(
      { error: '버전을 찾을 수 없습니다' },
      { status: 404 },
    )
  }

  return NextResponse.json(version, { status: 200 })
}
