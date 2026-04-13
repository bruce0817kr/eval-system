'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DownloadIcon, RefreshCcwIcon, CheckCircle2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Progress } from '@/components/ui/progress'
import type { SessionStatus } from '@/generated/prisma/client'

type ResultItem = {
  applicationId: string
  companyName: string
  rank: number | null
  finalScore: number | null
  status: string
}

type AggregationResult = {
  id: string
  triggerType: string
  triggerReason: string | null
  applicationsCount: number
  successCount: number
  errorCount: number
  computedAt: string
  computedBy: {
    id: string
    name: string
    email: string
  } | null
}

type ResultsTabContentProps = {
  sessionId: string
  sessionStatus: SessionStatus
}

export function ResultsTabContent({ sessionId, sessionStatus }: ResultsTabContentProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState<ResultItem[]>([])
  const [aggregations, setAggregations] = useState<AggregationResult[]>([])
  const [isRunningAggregation, setIsRunningAggregation] = useState(false)
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false)
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canRunAggregation = sessionStatus === 'closed'
  const canFinalize = sessionStatus === 'closed'
  const hasResults = results.some(r => r.finalScore !== null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [resultsRes, aggregationsRes] = await Promise.all([
        fetch(`/api/admin/sessions/${sessionId}/results`),
        fetch(`/api/admin/sessions/${sessionId}/aggregations`),
      ])

      if (!resultsRes.ok || !aggregationsRes.ok) {
        throw new Error('데이터를 불러오는데 실패했습니다')
      }

      const resultsData = await resultsRes.json()
      const aggregationsData = await aggregationsRes.json()

      setResults(resultsData.results || [])
      setAggregations(Array.isArray(aggregationsData) ? aggregationsData : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleRunAggregation = async () => {
    setIsRunningAggregation(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}/aggregate`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '집계 실행에 실패했습니다')
      }

      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '집계 실행에 실패했습니다')
    } finally {
      setIsRunningAggregation(false)
    }
  }

  const handleFinalize = async () => {
    setIsFinalizing(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'finalized' }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '결과 확정에 실패했습니다')
      }

      setFinalizeDialogOpen(false)
      router.refresh()
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '결과 확정에 실패했습니다')
    } finally {
      setIsFinalizing(false)
    }
  }

  const handleExportPDF = () => {
    window.open(`/api/admin/sessions/${sessionId}/results/pdf`, '_blank')
  }

  const handleExportExcel = () => {
    window.open(`/api/admin/sessions/${sessionId}/results/excel`, '_blank')
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error && !hasResults) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>오류 발생</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void fetchData()}>
            <RefreshCcwIcon className="size-4" />
            다시 시도
          </Button>
        </CardContent>
      </Card>
    )
  }

  const evaluatedCount = results.filter(r => r.finalScore !== null).length
  const lastManualAggregation = aggregations.find(a => a.triggerType === 'manual')

  return (
    <div className="space-y-4">
      {/* 에러 인라인 표시 */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* 액션 버튼 영역 */}
      <div className="flex flex-wrap items-center gap-2">
        {canRunAggregation && (
          <Button onClick={() => void handleRunAggregation()} disabled={isRunningAggregation} variant={hasResults ? "outline" : "default"}>
            {isRunningAggregation ? (
              <>
                <RefreshCcwIcon className="size-4 animate-spin" />
                집계 실행 중...
              </>
            ) : (
              <>
                <RefreshCcwIcon className="size-4" />
                {hasResults ? "재집계" : "집계 실행"}
              </>
            )}
          </Button>
        )}

        {sessionStatus === 'finalized' && hasResults && (
          <>
            <Button variant="outline" onClick={handleExportPDF}>
              <DownloadIcon className="size-4" />
              PDF 내보내기
            </Button>
            <Button variant="outline" onClick={handleExportExcel}>
              <DownloadIcon className="size-4" />
              Excel 내보내기
            </Button>
          </>
        )}

        {canFinalize && hasResults && (
          <AlertDialog open={finalizeDialogOpen} onOpenChange={setFinalizeDialogOpen}>
            <AlertDialogTrigger
              render={
                <Button disabled={isFinalizing}>
                  {isFinalizing ? (
                    <>
                      <RefreshCcwIcon className="size-4 animate-spin" />
                      확정 처리 중...
                    </>
                  ) : (
                    <>
                      <CheckCircle2Icon className="size-4" />
                      결과 확정
                    </>
                  )}
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>결과를 확정하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  확정 시 현재 집계 결과가 확정되어 저장됩니다.
                  확정 후에는 재개방하지 않는 한 순위를 변경할 수 없습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isFinalizing}>취소</AlertDialogCancel>
                <AlertDialogAction
                  disabled={isFinalizing}
                  onClick={() => void handleFinalize()}
                >
                  {isFinalizing ? (
                    <RefreshCcwIcon className="size-4 animate-spin" />
                  ) : null}
                  확정
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* 결과 테이블 */}
      {hasResults ? (
        <Card>
          <CardHeader>
            <CardTitle>평가 결과</CardTitle>
            <CardDescription>
              {lastManualAggregation
                ? `집계 일시: ${new Date(lastManualAggregation.computedAt).toLocaleString('ko-KR')}`
                : '최종 점수는 절사 평균 기준입니다.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">순위</TableHead>
                  <TableHead>기업명</TableHead>
                  <TableHead className="text-right">최종 점수</TableHead>
                  <TableHead className="text-center">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.applicationId}>
                    <TableCell>
                      {result.rank !== null ? (
                        <Badge
                          variant={result.rank <= 3 ? 'default' : 'secondary'}
                          className={
                            result.rank === 1
                              ? 'bg-yellow-500 hover:bg-yellow-500'
                              : result.rank === 2
                                ? 'bg-gray-400 hover:bg-gray-400'
                                : result.rank === 3
                                  ? 'bg-amber-600 hover:bg-amber-600'
                                  : ''
                          }
                        >
                          {result.rank}위
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{result.companyName}</TableCell>
                    <TableCell className="text-right font-mono">
                      {result.finalScore !== null ? result.finalScore.toFixed(2) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {result.status === 'completed' ? (
                        <Badge variant="default" className="bg-green-600">
                          완료
                        </Badge>
                      ) : result.status === 'excluded' ? (
                        <Badge variant="destructive">제외</Badge>
                      ) : (
                        <Badge variant="secondary">{result.status}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>평가 결과가 없습니다</CardTitle>
            <CardDescription>
              {sessionStatus === 'finalized' ? (
                <>최종 확정된 회차이지만 집계 결과가 없습니다.</>
              ) : !canRunAggregation ? (
                <>평가 회차가 마감(closed)된 후 집계가 가능합니다.</>
              ) : aggregations.length > 0 ? (
                <>집계 내역은 있지만 결과가 없습니다. 집계 오류를 확인하세요.</>
              ) : (
                <>집계 버튼을 눌러 결과를 계산하세요.</>
              )}
            </CardDescription>
          </CardHeader>
          {aggregations.length > 0 && (
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm font-medium">최근 집계 내역</p>
                <div className="space-y-1">
                  {aggregations.slice(0, 3).map((agg) => (
                    <div key={agg.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{new Date(agg.computedAt).toLocaleString('ko-KR')}</span>
                      <span>|</span>
                      <span>{agg.triggerType}</span>
                      <span>|</span>
                      <span>{agg.successCount}개 성공</span>
                      {agg.errorCount > 0 && (
                        <>
                          <span>|</span>
                          <span className="text-destructive">{agg.errorCount}개 실패</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* 통계 요약 */}
      {hasResults && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">평가 완료</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{evaluatedCount}</span>
                <span className="text-muted-foreground">/ {results.length}개</span>
              </div>
              <Progress
                value={results.length > 0 ? (evaluatedCount / results.length) * 100 : 0}
                className="mt-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">평균 점수</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">
                {evaluatedCount > 0
                  ? (
                      results
                        .filter(r => r.finalScore !== null)
                        .reduce((sum, r) => sum + (r.finalScore ?? 0), 0) / evaluatedCount
                    ).toFixed(2)
                  : '-'}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">최고 점수</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">
                {evaluatedCount > 0
                  ? Math.max(
                      ...results
                        .filter(r => r.finalScore !== null)
                        .map(r => r.finalScore ?? 0),
                    ).toFixed(2)
                  : '-'}
              </span>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
