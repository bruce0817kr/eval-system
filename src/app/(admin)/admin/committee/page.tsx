'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Edit,
  Plus,
  Search,
  Trash2,
  Upload,
  UserCheck,
  UserX,
} from 'lucide-react'

import {
  CommitteeCreateDialog,
} from '@/components/admin/committee-create-dialog'
import {
  CommitteeEditDialog,
  type CommitteeMemberItem,
} from '@/components/admin/committee-edit-dialog'
import { CommitteeImportDialog } from '@/components/admin/committee-import-dialog'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type CommitteeListResponse = {
  members: CommitteeMemberItem[]
  total: number
}

const PAGE_SIZE = 10

export default function AdminCommitteePage() {
  const [members, setMembers] = useState<CommitteeMemberItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'true' | 'false'>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [editMember, setEditMember] = useState<CommitteeMemberItem | null>(null)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  const fetchMembers = async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })

      if (search.trim()) {
        params.set('search', search.trim())
      }

      if (statusFilter !== 'all') {
        params.set('isActive', statusFilter)
      }

      const response = await fetch(`/api/admin/committee?${params.toString()}`)

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        setErrorMessage(payload.error ?? '평가위원 목록을 불러오지 못했습니다')
        return
      }

      const payload = (await response.json()) as CommitteeListResponse
      setMembers(payload.members)
      setTotal(payload.total)
    } catch {
      setErrorMessage('평가위원 목록을 불러오는 중 오류가 발생했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void fetchMembers()
  }, [page, search, statusFilter])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  const handleDeactivate = async (memberId: string) => {
    try {
      const response = await fetch(`/api/admin/committee/${memberId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        setErrorMessage(payload.error ?? '위원 비활성화에 실패했습니다')
        return
      }

      await fetchMembers()
    } catch {
      setErrorMessage('위원 비활성화 중 오류가 발생했습니다')
    }
  }

  const isEmpty = !isLoading && members.length === 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">평가위원 관리</h1>
          <p className="text-sm text-muted-foreground">
            평가위원 연락처와 활성 상태를 이 화면에서 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="size-4" />
            일괄 등록
          </Button>
          <Button type="button" onClick={() => setIsCreateOpen(true)}>
            <Plus className="size-4" />
            위원 추가
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
        <form
          className="flex w-full items-center gap-2 md:max-w-md"
          onSubmit={(event) => {
            event.preventDefault()
            setSearch(searchInput)
          }}
        >
          <div className="relative w-full">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="pl-8"
              placeholder="이름, 연락처, 소속 검색"
            />
          </div>
          <Button type="submit" variant="outline">
            검색
          </Button>
        </form>

        <Select
          value={statusFilter}
          onValueChange={(value) =>
            setStatusFilter(value === 'true' || value === 'false' ? value : 'all')
          }
        >
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="true">활성</SelectItem>
            <SelectItem value="false">비활성</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

      {isEmpty ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-lg font-medium">등록된 평가위원이 없습니다</p>
          <p className="mt-2 text-sm text-muted-foreground">
            위원을 추가하면 회차별 배정과 평가 접근 권한을 연결할 수 있습니다.
          </p>
          <Button className="mt-4" type="button" onClick={() => setIsCreateOpen(true)}>
            <Plus className="size-4" />
            위원 추가
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>연락처</TableHead>
                <TableHead>소속</TableHead>
                <TableHead>직위</TableHead>
                <TableHead>분야</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={`committee-skeleton-${index}`}>
                      {Array.from({ length: 7 }).map((__, cellIndex) => (
                        <TableCell key={`committee-skeleton-cell-${index}-${cellIndex}`}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell>{member.phone}</TableCell>
                      <TableCell>{member.organization ?? '-'}</TableCell>
                      <TableCell>{member.position ?? '-'}</TableCell>
                      <TableCell>{member.field ?? '-'}</TableCell>
                      <TableCell>
                        {member.isActive ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            <UserCheck className="size-3.5" /> 활성
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <UserX className="size-3.5" /> 비활성
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setEditMember(member)}
                          >
                            <Edit className="size-4" />
                            수정
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger render={<Button type="button" size="sm" variant="destructive" disabled={!member.isActive} />}>
                              <Trash2 className="size-4" />
                              비활성화
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>평가위원을 비활성화할까요?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  활성 회차에 배정되지 않은 경우에만 비활성화할 수 있습니다.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction
                                  variant="destructive"
                                  onClick={() => {
                                    void handleDeactivate(member.id)
                                  }}
                                >
                                  비활성화
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          총 {total}명 · {page} / {totalPages} 페이지
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1 || isLoading}
          >
            이전
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages || isLoading}
          >
            다음
          </Button>
        </div>
      </div>

      <CommitteeCreateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={() => {
          void fetchMembers()
        }}
      />
      <CommitteeImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImported={() => {
          void fetchMembers()
        }}
      />
      <CommitteeEditDialog
        open={Boolean(editMember)}
        onOpenChange={(open) => {
          if (!open) {
            setEditMember(null)
          }
        }}
        member={editMember}
        onUpdated={() => {
          setEditMember(null)
          void fetchMembers()
        }}
      />
    </div>
  )
}
