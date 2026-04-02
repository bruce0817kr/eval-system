import PDFDocument from 'pdfkit'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAdminSession, requireRole } from '@/lib/auth/jwt'
import { join } from 'path'

const FONT_REGULAR = join(process.cwd(), 'public', 'fonts', 'malgun.ttf')
const FONT_BOLD = join(process.cwd(), 'public', 'fonts', 'malgunbd.ttf')

const SYSTEM_FONT_REGULAR = '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc'
const SYSTEM_FONT_BOLD = '/usr/share/fonts/noto-cjk/NotoSansCJK-Bold.ttc'

const useSystemFont = process.env.USE_SYSTEM_FONT === 'true'
const FONT_PATH_REGULAR = useSystemFont ? SYSTEM_FONT_REGULAR : FONT_REGULAR
const FONT_PATH_BOLD = useSystemFont ? SYSTEM_FONT_BOLD : FONT_BOLD

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
              orderBy: { rank: 'asc' }
            }
          }
        }
      }
    })

    if (!evalSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 40,
      bufferPages: true,
      info: {
        Title: `평가결과표 - ${evalSession.title}`,
        Author: '중소기업 지원사업 선정평가 시스템',
        Subject: '평가 결과 보고서'
      }
    })

    // Collect PDF data
    const chunks: Uint8Array[] = []
    
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk))
    
    // Header
    doc.fontSize(20).font(FONT_BOLD)
      .text('평가결과표', { align: 'center' })
    doc.moveDown(0.5)
    
    doc.fontSize(14).font(FONT_REGULAR)
      .text(`평가 회차: ${evalSession.title}`, { align: 'center' })
    doc.moveDown(0.3)
    
    doc.fontSize(10).fillColor('#666666')
      .text(`생성일시: ${new Date().toLocaleString('ko-KR')}`, { align: 'center' })
    doc.moveDown(1)

    // Summary info
    const totalApplications = evalSession.applications.length
    const completedApplications = evalSession.applications.filter(
      app => app.resultSnapshots.length > 0
    ).length

    doc.fillColor('#333333').fontSize(11)
      .text(`총 신청 기업: ${totalApplications}개  |  평가 완료: ${completedApplications}개`, { align: 'center' })
    doc.moveDown(1)

    // Table header
    const tableTop = doc.y
    const colWidths = [50, 180, 120, 100, 100, 80]
    const colHeaders = ['순위', '기업명', '사업자번호', '대표자', '최종점수', '상태']
    
    doc.rect(40, tableTop, doc.page.width - 80, 25)
      .fill('#f3f4f6')
    
    doc.fillColor('#333333').fontSize(10).font(FONT_BOLD)
    let xPos = 45
    colHeaders.forEach((header, i) => {
      doc.text(header, xPos, tableTop + 8, { width: colWidths[i] - 10 })
      xPos += colWidths[i]
    })

    // Table rows
    let yPos = tableTop + 30
    const rowHeight = 22
    
    evalSession.applications
      .sort((a, b) => {
        const aRank = a.resultSnapshots[0]?.rank || 999
        const bRank = b.resultSnapshots[0]?.rank || 999
        return aRank - bRank
      })
      .forEach((app, index) => {
        const snapshot = app.resultSnapshots[0]
        const isEven = index % 2 === 0
        
        // Alternate row background
        if (isEven) {
          doc.rect(40, yPos - 3, doc.page.width - 80, rowHeight)
            .fill('#ffffff')
        } else {
          doc.rect(40, yPos - 3, doc.page.width - 80, rowHeight)
            .fill('#f9fafb')
        }
        
        doc.fillColor('#333333').fontSize(9).font(FONT_REGULAR)
        xPos = 45
        
        const rank = snapshot?.rank || '-'
        const score = snapshot?.finalScore !== null && snapshot?.finalScore !== undefined 
          ? snapshot.finalScore.toFixed(2) 
          : '-'
        const status = app.status === 'completed' ? '평가완료' 
          : app.status === 'evaluating' ? '평가중' 
          : app.status === 'registered' ? '신청완료' 
          : app.status === 'excluded' ? '제외' : app.status
        
        const rowData = [
          String(rank),
          app.company.name,
          app.company.businessNumber || '-',
          app.company.ceoName || '-',
          score,
          status
        ]
        
        rowData.forEach((cell, i) => {
          doc.text(cell, xPos, yPos, { width: colWidths[i] - 10, ellipsis: true })
          xPos += colWidths[i]
        })
        
        yPos += rowHeight
        
        // Check if we need a new page
        if (yPos > doc.page.height - 60) {
          doc.addPage()
          yPos = 40
        }
      })

    // Footer on each page
    const pageCount = doc.bufferedPageRange().count
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i)
      doc.fontSize(8).fillColor('#999999')
        .text(
          `페이지 ${i + 1} / ${pageCount}`,
          40,
          doc.page.height - 30,
          { align: 'center', width: doc.page.width - 80 }
        )
        .text(
          '중소기업 지원사업 선정평가 시스템 | CONFIDENTIAL',
          40,
          doc.page.height - 20,
          { align: 'center', width: doc.page.width - 80 }
        )
    }

    // Finalize PDF
    doc.end()

    // Wait for PDF to be generated
    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="evaluation-results-${evalSession.title.replace(/[^a-zA-Z0-9가-힣]/g, '-')}.pdf"`,
        'Content-Length': String(pdfBuffer.length)
      }
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json(
      { error: 'PDF generation failed' },
      { status: 500 }
    )
  }
}
