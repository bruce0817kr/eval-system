'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'

import { CompanySearchDialog } from '@/components/admin/company-search-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type ApplicationStatus = 'registered' | 'evaluating' | 'completed' | 'excluded'

export type ApplicationTableItem = {
  id: string
  evaluationOrder: number
  status: ApplicationStatus
  company: {
    id: string
    name: string
    ceoName: string | null
    businessNumber: string | null
    industry: string | null
  }
}

type ApplicationsResponse = {
  items: ApplicationTableItem[]
  totalPages: number
}

type SessionModeProps = {
  sessionId: string
  applications?: never
  onRemove?: never
  removingId?: never
}

type StaticModeProps = {
  sessionId?: never
  applications: ApplicationTableItem[]
  onRemove: (applicationId: string) => Promise<void> | void
  removingId: string | null
}

type Props = SessionModeProps | StaticModeProps

function renderStatusBadge(status: ApplicationStatus) {
  if (status === 'registered') {
    return <Badge variant="secondary">등록</Badge>
  }

  if (status === 'evaluating') {
    return <Badge>평가중</Badge>
  }

  if (status === 'completed') {
    return <Badge className="bg-emerald-600 text-white">완료</Badge>
  }

  return <Badge variant="destructive">제외</Badge>
}

export function ApplicationTable(props: Props) {
  const [items, setItems] = useState<ApplicationTableItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)

  const isSessionMode = 'sessionId' in props
  const sessionId = isSessionMode ? props.sessionId : null

  const fetchApplications = useCallback(async () => {
    if (!sessionId) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch(
        `/api/admin/sessions/${sessionId}/applications?page=${page}&pageSize=20`,
      )

      if (!response.ok) {
        return
      }

      const data = (await response.json()) as ApplicationsResponse
      setItems(data.items ?? [])
      setTotalPages(data.totalPages ?? 1)
    } finally {
      setLoading(false)
    }
  }, [page, sessionId])

  useEffect(() => {
    if (isSessionMode) {
      void fetchApplications()
      return
    }

    setItems(props.applications)
    setLoading(false)
    setTotalPages(1)
  }, [fetchApplications, isSessionMode, props])

  const orderedIds = useMemo(() => items.map((item) => item.id), [items])

  async function move(index: number, direction: -1 | 1) {
    if (!sessionId) {
      return
    }

    const nextIndex = index + direction

    if (nextIndex < 0 || nextIndex >= items.length) {
      return
    }

    const reordered = [...orderedIds]
    const target = reordered[index]
    reordered[index] = reordered[nextIndex]
    reordered[nextIndex] = target

    const local = [...items]
    const localTarget = local[index]
    local[index] = local[nextIndex]
    local[nextIndex] = localTarget
    setItems(local)

    await fetch(`/api/admin/sessions/${sessionId}/applications/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: reordered }),
    })

    await fetchApplications()
  }

  async function addCompany(company: { id: string }) {
    if (!sessionId) {
      return
    }

    await fetch(`/api/admin/sessions/${sessionId}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: company.id }),
    })

    await fetchApplications()
  }

  async function removeApplication(applicationId: string) {
    if (!window.confirm('해당 기업을 세션에서 제거하시겠습니까?')) {
      return
    }

    if (isSessionMode && sessionId) {
      await fetch(`/api/admin/sessions/${sessionId}/applications`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId }),
      })
      await fetchApplications()
      return
    }

    if (!isSessionMode) {
      await props.onRemove(applicationId)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">신청 기업 목록</h3>
        {isSessionMode ? (
          <Button variant="outline" onClick={() => setSearchDialogOpen(true)}>
            <Plus />
            기업 추가
          </Button>
        ) : null}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">순서</TableHead>
            <TableHead>기업명</TableHead>
            <TableHead>대표자</TableHead>
            <TableHead>사업자등록번호</TableHead>
            <TableHead>업종</TableHead>
            <TableHead>상태</TableHead>
            <TableHead className="text-right">액션</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                불러오는 중...
              </TableCell>
            </TableRow>
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                등록된 기업이 없습니다. CSV/Excel 파일을 업로드하거나 개별 추가하세요.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item, index) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span className="w-7 text-xs text-muted-foreground">{item.evaluationOrder}</span>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      disabled={index === 0 || !isSessionMode}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      disabled={index === items.length - 1 || !isSessionMode}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{item.company.name}</TableCell>
                <TableCell>{item.company.ceoName ?? '-'}</TableCell>
                <TableCell>{item.company.businessNumber ?? '-'}</TableCell>
                <TableCell>{item.company.industry ?? '-'}</TableCell>
                <TableCell>{renderStatusBadge(item.status)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeApplication(item.id)}
                    disabled={!isSessionMode && props.removingId === item.id}
                    aria-label="신청 제거"
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {isSessionMode ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            이전
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            다음
          </Button>
        </div>
      ) : null}

      {isSessionMode ? (
        <CompanySearchDialog
          open={searchDialogOpen}
          onOpenChange={setSearchDialogOpen}
          onSelectCompany={addCompany}
        />
      ) : null}
    </div>
  )
}
