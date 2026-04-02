import { NextResponse } from 'next/server'

import { getAdminSession } from '@/lib/auth/jwt'
import {
  calculateTemplateStats,
  getDefaultTemplateSchema,
} from '@/lib/form-template-schema'

function unauthorized() {
  return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
}

export async function GET(request: Request) {
  const adminSession = await getAdminSession(request)

  if (!adminSession) {
    return unauthorized()
  }

  const schema = getDefaultTemplateSchema()
  const stats = calculateTemplateStats(schema)

  return NextResponse.json(
    {
      id: 'default-template',
      name: '기본 템플릿',
      description: '중소기업 기술/사업성 종합평가 기본 양식',
      versionNumber: 1,
      schema,
      totalScore: stats.totalScore,
      itemsCount: stats.itemsCount,
    },
    { status: 200 },
  )
}
