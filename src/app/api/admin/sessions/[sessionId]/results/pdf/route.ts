import { NextRequest, NextResponse } from 'next/server'

import { getAdminSession, requireRole } from '@/lib/auth/jwt'
import { prisma } from '@/lib/db'

function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function buildPdfBuffer(lines: string[]) {
  const contentLines = lines.slice(0, 32).map((line, index) => {
    const y = 790 - index * 20
    return `BT /F1 10 Tf 40 ${y} Td (${escapePdfText(line)}) Tj ET`
  })
  const content = contentLines.join('\n')
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream\nendobj\n`,
  ]

  let offset = '%PDF-1.4\n'.length
  const xrefs = ['0000000000 65535 f \n']
  for (const object of objects) {
    xrefs.push(`${String(offset).padStart(10, '0')} 00000 n \n`)
    offset += Buffer.byteLength(object, 'latin1')
  }

  const body = objects.join('')
  const xrefOffset = Buffer.byteLength(`%PDF-1.4\n${body}`, 'latin1')
  const pdf = `%PDF-1.4\n${body}xref\n0 ${objects.length + 1}\n${xrefs.join('')}trailer\n<< /Size ${
    objects.length + 1
  } /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(pdf, 'latin1')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
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
              orderBy: { rank: 'asc' },
              take: 1,
            },
          },
        },
      },
    })

    if (!evalSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const sortedApplications = [...evalSession.applications].sort((a, b) => {
      const aRank = a.resultSnapshots[0]?.rank ?? 999
      const bRank = b.resultSnapshots[0]?.rank ?? 999
      return aRank - bRank
    })

    const lines = [
      `Evaluation Results - ${evalSession.title}`,
      `Generated At: ${new Date().toISOString()}`,
      `Total Applications: ${evalSession.applications.length}`,
      '',
      ...sortedApplications.map((app) => {
        const snapshot = app.resultSnapshots[0]
        const rank = snapshot?.rank ?? '-'
        const score = snapshot?.finalScore?.toFixed(2) ?? '-'
        const selected = typeof snapshot?.rank === 'number' && snapshot.rank <= 3 ? 'SELECTED' : ''
        return `${rank}. ${app.company.name} | score: ${score} ${selected}`
      }),
    ]

    const pdfBuffer = buildPdfBuffer(lines)
    const filename = `evaluation-results-${evalSession.id}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
  }
}
