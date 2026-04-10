'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

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
import { Label } from '@/components/ui/label'

export type CompanyItem = {
  id: string
  name: string
  ceoName: string | null
  businessNumber: string | null
  address: string | null
  phone: string | null
  email: string | null
  industry: string | null
  foundedDate: string | null
  createdAt: string
}

type CompanyEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  company: CompanyItem | null
  onUpdated: () => void
}

type EditFormState = {
  name: string
  ceoName: string
  businessNumber: string
  address: string
  phone: string
  email: string
  industry: string
  foundedDate: string
}

function toFormState(company: CompanyItem): EditFormState {
  return {
    name: company.name,
    ceoName: company.ceoName ?? '',
    businessNumber: company.businessNumber ?? '',
    address: company.address ?? '',
    phone: company.phone ?? '',
    email: company.email ?? '',
    industry: company.industry ?? '',
    foundedDate: company.foundedDate
      ? company.foundedDate.slice(0, 10)
      : '',
  }
}

export function CompanyEditDialog({
  open,
  onOpenChange,
  company,
  onUpdated,
}: CompanyEditDialogProps) {
  const [form, setForm] = useState<EditFormState | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (company) {
      setForm(toFormState(company))
      setErrorMessage(null)
    }
  }, [company])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!company || !form) return

    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      const body: Record<string, string | null | undefined> = {
        name: form.name,
        ceoName: form.ceoName.trim() || null,
        businessNumber: form.businessNumber.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        industry: form.industry.trim() || null,
        foundedDate: form.foundedDate || null,
      }

      const response = await fetch(`/api/admin/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        setErrorMessage(result.error ?? '기업 정보 수정에 실패했습니다')
        return
      }

      onOpenChange(false)
      onUpdated()
    } catch {
      setErrorMessage('기업 정보 수정 중 오류가 발생했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!company || !form) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>기업 정보 수정</DialogTitle>
          <DialogDescription>
            기업 기본 정보를 수정합니다.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="company-edit-name">기업명 *</Label>
            <Input
              id="company-edit-name"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => prev ? { ...prev, name: e.target.value } : prev)
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-edit-ceo">대표자명</Label>
              <Input
                id="company-edit-ceo"
                value={form.ceoName}
                onChange={(e) =>
                  setForm((prev) => prev ? { ...prev, ceoName: e.target.value } : prev)
                }
                placeholder="홍길동"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-edit-biz">사업자등록번호</Label>
              <Input
                id="company-edit-biz"
                value={form.businessNumber}
                onChange={(e) =>
                  setForm((prev) => prev ? { ...prev, businessNumber: e.target.value } : prev)
                }
                placeholder="123-45-67890"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-edit-address">주소</Label>
            <Input
              id="company-edit-address"
              value={form.address}
              onChange={(e) =>
                setForm((prev) => prev ? { ...prev, address: e.target.value } : prev)
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-edit-phone">전화번호</Label>
              <Input
                id="company-edit-phone"
                value={form.phone}
                onChange={(e) =>
                  setForm((prev) => prev ? { ...prev, phone: e.target.value } : prev)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-edit-email">이메일</Label>
              <Input
                id="company-edit-email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => prev ? { ...prev, email: e.target.value } : prev)
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-edit-industry">업종</Label>
              <Input
                id="company-edit-industry"
                value={form.industry}
                onChange={(e) =>
                  setForm((prev) => prev ? { ...prev, industry: e.target.value } : prev)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-edit-founded">설립일</Label>
              <Input
                id="company-edit-founded"
                type="date"
                value={form.foundedDate}
                onChange={(e) =>
                  setForm((prev) => prev ? { ...prev, foundedDate: e.target.value } : prev)
                }
              />
            </div>
          </div>

          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              취소
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '저장 중...' : '저장하기'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
