'use client'

import { useState } from 'react'
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

type CompanyCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

type CreateFormState = {
  name: string
  ceoName: string
  businessNumber: string
  address: string
  phone: string
  email: string
  industry: string
  foundedDate: string
}

const initialFormState: CreateFormState = {
  name: '',
  ceoName: '',
  businessNumber: '',
  address: '',
  phone: '',
  email: '',
  industry: '',
  foundedDate: '',
}

export function CompanyCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: CompanyCreateDialogProps) {
  const [form, setForm] = useState<CreateFormState>(initialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleChange = (key: keyof CreateFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      const body: Record<string, string | undefined> = { name: form.name }
      if (form.ceoName.trim()) body.ceoName = form.ceoName.trim()
      if (form.businessNumber.trim()) body.businessNumber = form.businessNumber.trim()
      if (form.address.trim()) body.address = form.address.trim()
      if (form.phone.trim()) body.phone = form.phone.trim()
      if (form.email.trim()) body.email = form.email.trim()
      if (form.industry.trim()) body.industry = form.industry.trim()
      if (form.foundedDate.trim()) body.foundedDate = form.foundedDate.trim()

      const response = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        setErrorMessage(result.error ?? '기업 등록에 실패했습니다')
        return
      }

      setForm(initialFormState)
      onOpenChange(false)
      onCreated()
    } catch {
      setErrorMessage('기업 등록 중 오류가 발생했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>기업 등록</DialogTitle>
          <DialogDescription>
            기업 기본 정보를 입력합니다. 기업명은 필수입니다.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="company-create-name">기업명 *</Label>
            <Input
              id="company-create-name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="(주)한국기술"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-create-ceo">대표자명</Label>
              <Input
                id="company-create-ceo"
                value={form.ceoName}
                onChange={(e) => handleChange('ceoName', e.target.value)}
                placeholder="홍길동"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-create-biz">사업자등록번호</Label>
              <Input
                id="company-create-biz"
                value={form.businessNumber}
                onChange={(e) => handleChange('businessNumber', e.target.value)}
                placeholder="123-45-67890"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-create-address">주소</Label>
            <Input
              id="company-create-address"
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="서울시 강남구 테헤란로 123"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-create-phone">전화번호</Label>
              <Input
                id="company-create-phone"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="02-1234-5678"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-create-email">이메일</Label>
              <Input
                id="company-create-email"
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="contact@company.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-create-industry">업종</Label>
              <Input
                id="company-create-industry"
                value={form.industry}
                onChange={(e) => handleChange('industry', e.target.value)}
                placeholder="IT/소프트웨어"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-create-founded">설립일</Label>
              <Input
                id="company-create-founded"
                type="date"
                value={form.foundedDate}
                onChange={(e) => handleChange('foundedDate', e.target.value)}
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
              {isSubmitting ? '등록 중...' : '등록하기'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
