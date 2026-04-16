'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit, Plus, Search, Trash2 } from 'lucide-react'

import {
  CompanyCreateDialog,
} from '@/components/admin/company-create-dialog'
import {
  CompanyEditDialog,
  type CompanyItem,
} from '@/components/admin/company-edit-dialog'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type CompanyListResponse = {
  items: CompanyItem[]
  total: number
}

const PAGE_SIZE = 10

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<CompanyItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editCompany, setEditCompany] = useState<CompanyItem | null>(null)

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total],
  )

  const fetchCompanies = useCallback(async () => {
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

      const response = await fetch(`/api/admin/companies?${params.toString()}`)

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        setErrorMessage(payload.error ?? '기업 목록을 불러오지 못했습니다')
        return
      }

      const payload = (await response.json()) as CompanyListResponse
      setCompanies(payload.items)
      setTotal(payload.total)
    } catch {
      setErrorMessage('기업 목록을 불러오는 중 오류가 발생했습니다')
    } finally {
      setIsLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    void fetchCompanies()
  }, [fetchCompanies])

  useEffect(() => {
    setPage(1)
  }, [search])

  const handleDelete = async (companyId: string) => {
    try {
      const response = await fetch(`/api/admin/companies/${companyId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        setErrorMessage(payload.error ?? '기업 삭제에 실패했습니다')
        return
      }

      await fetchCompanies()
    } catch {
      setErrorMessage('기업 삭제 중 오류가 발생했습니다')
    }
  }

  const isEmpty = !isLoading && companies.length === 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">기업 관리</h1>
          <p className="text-sm text-muted-foreground">
            평가 대상 기업의 기본 정보와 제출 상태를 관리합니다.
          </p>
        </div>
        <Button type="button" onClick={() => setIsCreateOpen(true)}>
          <Plus className="size-4" />
          기업 등록
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center">
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
              placeholder="기업명, 대표자, 사업자번호, 업종 검색"
            />
          </div>
          <Button type="submit" variant="outline">
            검색
          </Button>
        </form>
      </div>

      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}

      {isEmpty ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-lg font-medium">등록된 기업이 없습니다</p>
          <p className="mt-2 text-sm text-muted-foreground">
            기업을 등록하면 회차별 배정과 제출 현황을 추적할 수 있습니다.
          </p>
          <Button
            className="mt-4"
            type="button"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="size-4" />
            기업 등록하기
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>기업명</TableHead>
                <TableHead>대표자</TableHead>
                <TableHead>사업자등록번호</TableHead>
                <TableHead>업종</TableHead>
                <TableHead>전화번호</TableHead>
                <TableHead className="text-right">액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={`company-skeleton-${index}`}>
                      {Array.from({ length: 6 }).map((__, cellIndex) => (
                        <TableCell key={`company-skeleton-cell-${index}-${cellIndex}`}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">
                        {company.name}
                      </TableCell>
                      <TableCell>{company.ceoName ?? '-'}</TableCell>
                      <TableCell>{company.businessNumber ?? '-'}</TableCell>
                      <TableCell>{company.industry ?? '-'}</TableCell>
                      <TableCell>{company.phone ?? '-'}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setEditCompany(company)}
                          >
                            <Edit className="size-4" />
                            수정
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger
                              render={
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                />
                              }
                            >
                              <Trash2 className="size-4" />
                              삭제
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  기업을 삭제할까요?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  세션 신청 이력이 없는 기업만 삭제할 수
                                  있습니다. 삭제 후 복구할 수 없습니다.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction
                                  variant="destructive"
                                  onClick={() => {
                                    void handleDelete(company.id)
                                  }}
                                >
                                  삭제
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
          총 {total}개 · {page} / {totalPages} 페이지
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

      <CompanyCreateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={() => {
          void fetchCompanies()
        }}
      />
      <CompanyEditDialog
        open={Boolean(editCompany)}
        onOpenChange={(open) => {
          if (!open) setEditCompany(null)
        }}
        company={editCompany}
        onUpdated={() => {
          setEditCompany(null)
          void fetchCompanies()
        }}
      />
    </div>
  )
}
