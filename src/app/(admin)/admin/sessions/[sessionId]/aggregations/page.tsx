"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { RefreshCcwIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type AggregationItem = {
  id: string
  triggerType: string
  applicationsCount: number
  successCount: number
  errorCount: number
  computedAt: string
  computedBy: {
    name: string
    email: string
  } | null
}

function triggerTypeLabel(type: string) {
  if (type === "manual") return "수동"
  if (type === "auto") return "자동"
  if (type === "reopen") return "재개방"
  if (type === "finalize") return "확정"
  return type
}

export default function AdminSessionAggregationsPage() {
  const params = useParams<{ sessionId: string }>()
  const sessionId = params.sessionId
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aggregations, setAggregations] = useState<AggregationItem[]>([])

  const fetchAggregations = useCallback(async () => {
    if (!sessionId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}/aggregations`)
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? "집계 이력을 불러오지 못했습니다.")
      }

      const data = (await response.json()) as AggregationItem[]
      setAggregations(data)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "집계 이력을 불러오지 못했습니다.")
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAggregations()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [fetchAggregations])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>오류 발생</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void fetchAggregations()}>
            <RefreshCcwIcon className="size-4" />
            새로고침
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (aggregations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>집계 이력</CardTitle>
          <CardDescription>
            집계 이력이 없습니다. 평가가 완료되면 결과 탭에서 집계를 실행하세요.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>집계 이력</CardTitle>
          <Link
            href={`/admin/sessions/${sessionId}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            세션 상세로 돌아가기
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>일시</TableHead>
              <TableHead>유형</TableHead>
              <TableHead>기업 수</TableHead>
              <TableHead>성공</TableHead>
              <TableHead>실패</TableHead>
              <TableHead>실행자</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aggregations.map((aggregation) => (
              <TableRow key={aggregation.id}>
                <TableCell>{new Date(aggregation.computedAt).toLocaleString("ko-KR")}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{triggerTypeLabel(aggregation.triggerType)}</Badge>
                </TableCell>
                <TableCell>{aggregation.applicationsCount}</TableCell>
                <TableCell>
                  <Badge>{aggregation.successCount}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={aggregation.errorCount > 0 ? "destructive" : "secondary"}>
                    {aggregation.errorCount}
                  </Badge>
                </TableCell>
                <TableCell>
                  {aggregation.computedBy ? (
                    <div>
                      <div className="font-medium">{aggregation.computedBy.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {aggregation.computedBy.email}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">시스템</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
