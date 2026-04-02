'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

type Company = {
  id: string
  name: string
  ceoName: string | null
  businessNumber: string | null
  industry: string | null
}

type CompaniesResponse = {
  items: Company[]
  total: number
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectCompany: (company: Company) => Promise<void> | void
}

export function CompanySearchDialog({ open, onOpenChange, onSelectCompany }: Props) {
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Company[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    ceoName: '',
    businessNumber: '',
    address: '',
    phone: '',
    email: '',
    industry: '',
  })
  const [createLoading, setCreateLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    const controller = new AbortController()

    async function fetchCompanies() {
      setLoading(true)

      try {
        const response = await fetch(
          `/api/admin/companies?search=${encodeURIComponent(search)}&page=1&pageSize=30`,
          {
            signal: controller.signal,
          },
        )

        if (!response.ok) {
          return
        }

        const data = (await response.json()) as CompaniesResponse
        setResults(data.items ?? [])
      } finally {
        setLoading(false)
      }
    }

    fetchCompanies()

    return () => controller.abort()
  }, [open, search])

  async function handleCreateCompany() {
    if (!createForm.name.trim()) {
      return
    }

    setCreateLoading(true)

    try {
      const response = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: createForm.name,
          ceoName: createForm.ceoName || undefined,
          businessNumber: createForm.businessNumber || undefined,
          address: createForm.address || undefined,
          phone: createForm.phone || undefined,
          email: createForm.email || undefined,
          industry: createForm.industry || undefined,
        }),
      })

      if (!response.ok) {
        return
      }

      const created = (await response.json()) as Company
      await onSelectCompany(created)
      onOpenChange(false)
    } finally {
      setCreateLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>기업 검색</DialogTitle>
          <DialogDescription>
            기존 기업을 선택하거나 새 기업을 등록하세요.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="기업명/대표자/사업자등록번호 검색"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <ScrollArea className="h-72 rounded-md border">
          <div className="divide-y">
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground">검색 중...</p>
            ) : results.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">검색 결과가 없습니다.</p>
            ) : (
              results.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  className="w-full p-3 text-left hover:bg-muted/50"
                  onClick={async () => {
                    await onSelectCompany(company)
                    onOpenChange(false)
                  }}
                >
                  <p className="font-medium">{company.name}</p>
                  <p className="text-xs text-muted-foreground">
                    대표자: {company.ceoName ?? '-'} · 사업자등록번호:{' '}
                    {company.businessNumber ?? '-'} · 업종: {company.industry ?? '-'}
                  </p>
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        {showCreateForm ? (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">새 기업 등록</p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="기업명*"
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
              <Input
                placeholder="대표자명"
                value={createForm.ceoName}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, ceoName: event.target.value }))
                }
              />
              <Input
                placeholder="사업자등록번호"
                value={createForm.businessNumber}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, businessNumber: event.target.value }))
                }
              />
              <Input
                placeholder="업종"
                value={createForm.industry}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, industry: event.target.value }))
                }
              />
              <Input
                placeholder="전화"
                value={createForm.phone}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, phone: event.target.value }))
                }
              />
              <Input
                placeholder="이메일"
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, email: event.target.value }))
                }
              />
              <Input
                className="col-span-2"
                placeholder="주소"
                value={createForm.address}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, address: event.target.value }))
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(false)}
                disabled={createLoading}
              >
                취소
              </Button>
              <Button onClick={handleCreateCompany} disabled={createLoading}>
                {createLoading ? '등록 중...' : '등록 후 선택'}
              </Button>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          {!showCreateForm ? (
            <Button variant="outline" onClick={() => setShowCreateForm(true)}>
              새 기업 등록
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
