'use client'

import { useCallback, useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type SubmissionItem = {
  id: string
  submissionState: string
  totalScore: number | null
  submittedAt: string | null
  signedAt: string | null
  application: {
    evaluationOrder: number
    company: { name: string }
  }
  signatureArtifact: {
    id: string
    signedAt: string
    otpVerified: boolean
  } | null
}

type Props = {
  sessionId: string
  memberId: string
  memberName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STATE_LABEL: Record<string, string> = {
  draft: '작성중',
  submitted: '제출완료',
  signed: '서명완료',
  invalidated: '무효',
}

function getStateBadgeVariant(state: string) {
  if (state === 'signed') return 'default' as const
  if (state === 'submitted') return 'secondary' as const
  if (state === 'invalidated') return 'destructive' as const
  return 'outline' as const
}

export function SubmissionDialog({
  sessionId,
  memberId,
  memberName,
  open,
  onOpenChange,
}: Props) {
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSubmissions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/sessions/${sessionId}/submissions?memberId=${memberId}`,
      )
      if (!res.ok) {
        setError('제출 내역을 불러오지 못했습니다')
        return
      }
      const data = (await res.json()) as { submissions: SubmissionItem[] }
      setSubmissions(data.submissions)
    } finally {
      setLoading(false)
    }
  }, [sessionId, memberId])

  useEffect(() => {
    if (open) void fetchSubmissions()
  }, [open, fetchSubmissions])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>제출 현황</DialogTitle>
          <DialogDescription>{memberName} 위원의 평가 제출 내역</DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">불러오는 중...</p>
        ) : submissions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">제출된 평가가 없습니다</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">순서</TableHead>
                  <TableHead>기업명</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">점수</TableHead>
                  <TableHead>제출일시</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="text-muted-foreground">
                      {sub.application.evaluationOrder}
                    </TableCell>
                    <TableCell className="font-medium">
                      {sub.application.company.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStateBadgeVariant(sub.submissionState)}>
                        {STATE_LABEL[sub.submissionState] ?? sub.submissionState}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {sub.totalScore !== null ? sub.totalScore.toFixed(2) : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {sub.signedAt
                        ? new Date(sub.signedAt).toLocaleString('ko-KR')
                        : sub.submittedAt
                          ? new Date(sub.submittedAt).toLocaleString('ko-KR')
                          : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
