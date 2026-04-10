"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCcwIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
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

type AuditEventItem = {
  id: string
  occurredAt: string
  actorType: string
  actorId: string
  actorName: string | null
  action: string
  targetType: string | null
  ipAddress: string | null
  session: { id: string; title: string } | null
}

type AuditResponse = {
  events: AuditEventItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const ACTION_LABEL: Record<string, string> = {
  login: "로그인", logout: "로그아웃", view: "조회", create: "생성",
  update: "수정", delete: "삭제", submit: "제출", sign: "서명",
  reopen: "재개방", finalize: "확정", import: "가져오기", export: "내보내기",
  download: "다운로드", aggregate: "집계",
}

const ACTOR_LABEL: Record<string, string> = {
  admin: "관리자", committee_member: "평가위원", system: "시스템",
}

const ACTIONS = [
  "login", "logout", "create", "update", "delete",
  "submit", "sign", "aggregate", "finalize", "reopen", "import", "export",
]

export default function AdminAuditLogPage() {
  const [data, setData] = useState<AuditResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [actorTypeFilter, setActorTypeFilter] = useState("")
  const [actionFilter, setActionFilter] = useState("")

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "30" })
      if (actorTypeFilter) params.set("actorType", actorTypeFilter)
      if (actionFilter) params.set("action", actionFilter)
      const res = await fetch(`/api/admin/audit-log?${params.toString()}`)
      if (!res.ok) {
        setError('감사 로그를 불러오지 못했습니다')
        return
      }
      const json = (await res.json()) as AuditResponse
      setData(json)
    } catch {
      setError('네트워크 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }, [page, actorTypeFilter, actionFilter])

  useEffect(() => {
    void fetchEvents()
  }, [fetchEvents])

  function handleFilterChange() {
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">감사 로그</h1>
        <p className="text-sm text-stone-600">사용자 활동과 주요 변경 이력을 추적합니다.</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>이벤트 목록</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => void fetchEvents()} disabled={loading}>
            <RefreshCcwIcon className={`size-4 ${loading ? "animate-spin" : ""}`} />
            새로고침
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 필터 */}
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-md border px-2 py-1 text-sm"
              value={actorTypeFilter}
              onChange={(e) => { setActorTypeFilter(e.target.value); handleFilterChange() }}
            >
              <option value="">전체 행위자</option>
              <option value="admin">관리자</option>
              <option value="committee_member">평가위원</option>
              <option value="system">시스템</option>
            </select>
            <select
              className="rounded-md border px-2 py-1 text-sm"
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); handleFilterChange() }}
            >
              <option value="">전체 동작</option>
              {ACTIONS.map(a => (
                <option key={a} value={a}>{ACTION_LABEL[a] ?? a}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !data || data.events.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">기록된 감사 이벤트가 없습니다.</p>
          ) : (
            <>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">일시</TableHead>
                      <TableHead className="w-32">행위자</TableHead>
                      <TableHead className="w-24">동작</TableHead>
                      <TableHead>대상</TableHead>
                      <TableHead>회차</TableHead>
                      <TableHead className="w-28">IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(event.occurredAt).toLocaleString("ko-KR")}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <Badge variant="outline">
                              {ACTOR_LABEL[event.actorType] ?? event.actorType}
                            </Badge>
                            {event.actorName && (
                              <p className="text-xs text-muted-foreground">{event.actorName}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {ACTION_LABEL[event.action] ?? event.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{event.targetType ?? "-"}</TableCell>
                        <TableCell className="max-w-48 truncate text-xs text-muted-foreground">
                          {event.session?.title ?? "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {event.ipAddress ?? "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">총 {data.total}건</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>이전</Button>
                  <span className="text-sm text-muted-foreground">{page} / {data.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}>다음</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
