import * as XLSX from 'xlsx'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAdminSession, requireRole } from '@/lib/auth/jwt'
import type { FormSchema } from '@/lib/form-template-schema'

type CriteriaDataEntry = {
  '대분류': string
  '항목ID': string
  '항목명': string
  '배점': number
  '최고점수': number
}

function escapeCellValue(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^[=+\-@\t\r\n]/.test(trimmed)) {
      return `'${trimmed}`
    }
    return trimmed
  }
  return value
}

function escapeRow(row: Record<string, unknown>): Record<string, unknown> {
  const escaped: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(row)) {
    escaped[key] = escapeCellValue(val)
  }
  return escaped
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const resolvedParams = await params
    const session = await getAdminSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!requireRole(session, 'operator')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const evalSession = await prisma.evaluationSession.findUnique({
      where: { id: resolvedParams.sessionId },
      include: {
        applications: {
          include: {
            company: true,
            resultSnapshots: {
              orderBy: {
                rank: 'asc'
              }
            },
            evaluationSubmissions: {
              where: {
                submissionState: 'signed',
                isValid: true
              },
              include: {
                committeeMember: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        },
        formDefinition: {
          select: {
            schemaJson: true
          }
        }
      }
    })

    if (!evalSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'excel'

    if (format === 'excel') {
      const sortedApps = [...evalSession.applications].sort((a, b) => {
        const aRank = a.resultSnapshots[0]?.rank || 999
        const bRank = b.resultSnapshots[0]?.rank || 999
        return aRank - bRank
      })

      const mainData = sortedApps.map((app, idx) => {
        const snapshot = app.resultSnapshots[0]
        return escapeRow({
          '순위': snapshot?.rank || '',
          '기업명': app.company.name,
          '사업자번호': app.company.businessNumber || '',
          '대표자명': app.company.ceoName || '',
          '연락처': app.company.phone || '',
          '이메일': app.company.email || '',
          '주소': app.company.address || '',
          '최종점수': snapshot?.finalScore !== undefined && snapshot?.finalScore !== null 
            ? Number(snapshot.finalScore.toFixed(2)) 
            : '',
          '평가위원수': app.evaluationSubmissions.length,
          '상태': app.status === 'completed' ? '평가완료' 
            : app.status === 'evaluating' ? '평가중' 
            : app.status === 'registered' ? '신청완료' 
            : app.status === 'excluded' ? '제외' 
            : app.status
        })
      })

      const workbook = XLSX.utils.book_new()

      const summaryWsData = [
        ['평가 결과 요약'],
        [''],
        ['평가 회차', evalSession.title],
        ['총 신청 기업 수', evalSession.applications.length],
        ['평가 완료 기업 수', mainData.filter(r => r['상태'] === '평가완료').length],
        ['미평가 기업 수', mainData.filter(r => r['상태'] !== '평가완료').length],
        ['생성 일시', new Date().toLocaleString('ko-KR')],
        [''],
        ['평점 산정 방식', '최고/최저점 제외 평균'],
        ['합격 기준', '권고치 이상']
      ]
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryWsData)
      XLSX.utils.book_append_sheet(workbook, summaryWs, '요약')

      const mainWs = XLSX.utils.json_to_sheet(mainData)
      XLSX.utils.book_append_sheet(workbook, mainWs, '평가결과')

      if (evalSession.formDefinition?.schemaJson) {
        const schema = evalSession.formDefinition.schemaJson as FormSchema
        const criteriaData: CriteriaDataEntry[] = []
        
        if (schema.sections) {
          for (const section of schema.sections) {
            for (const item of section.items) {
              if (item.type === 'radio_score') {
                criteriaData.push({
                  '대분류': section.title || '기본',
                  '항목ID': item.id,
                  '항목명': item.label,
                  '배점': item.weight,
                  '최고점수': item.options ? Math.max(...item.options.map((o) => o.score)) : 0
                })
              }
            }
          }
        }
        
        if (criteriaData.length > 0) {
          const criteriaWs = XLSX.utils.json_to_sheet(criteriaData)
          XLSX.utils.book_append_sheet(workbook, criteriaWs, '평가항목')
        }
      }

      const detailData = sortedApps.flatMap((app) => {
        return app.evaluationSubmissions.map(sub => escapeRow({
          '기업명': app.company.name,
          '평가위원': sub.committeeMember?.name || '',
          '점수': sub.totalScore || 0,
          '서명일시': sub.signedAt ? new Date(sub.signedAt).toLocaleString('ko-KR') : ''
        }))
      })

      if (detailData.length > 0) {
        const detailWs = XLSX.utils.json_to_sheet(detailData)
        XLSX.utils.book_append_sheet(workbook, detailWs, '상세점수')
      }

      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

      const filename = `evaluation-results-${evalSession.title.replace(/[^a-zA-Z0-9가-힣]/g, '-')}.xlsx`

      return new NextResponse(excelBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(excelBuffer.length)
        }
      })
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
  } catch (error) {
    console.error('Excel export error:', error)
    return NextResponse.json(
      { error: 'Excel export failed' },
      { status: 500 }
    )
  }
}
