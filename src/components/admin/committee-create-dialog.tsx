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

type CommitteeCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

type CreateFormState = {
  name: string
  phone: string
  organization: string
  position: string
  field: string
}

const initialFormState: CreateFormState = {
  name: '',
  phone: '',
  organization: '',
  position: '',
  field: '',
}

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)

  if (digits.length <= 3) {
    return digits
  }

  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

export function CommitteeCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: CommitteeCreateDialogProps) {
  const [form, setForm] = useState<CreateFormState>(initialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleChange = (key: keyof CreateFormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: key === 'phone' ? formatPhoneInput(value) : value,
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/admin/committee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        setErrorMessage(result.error ?? '위원 등록에 실패했습니다')
        return
      }

      setForm(initialFormState)
      onOpenChange(false)
      onCreated()
    } catch {
      setErrorMessage('위원 등록 중 오류가 발생했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>평가위원 추가</DialogTitle>
          <DialogDescription>
            기본 정보를 입력하면 회차에서 위원을 배정할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="committee-create-name">이름</Label>
            <Input
              id="committee-create-name"
              value={form.name}
              onChange={(event) => handleChange('name', event.target.value)}
              placeholder="홍길동"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="committee-create-phone">연락처</Label>
            <Input
              id="committee-create-phone"
              value={form.phone}
              onChange={(event) => handleChange('phone', event.target.value)}
              placeholder="010-1234-5678"
              inputMode="numeric"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="committee-create-organization">소속</Label>
            <Input
              id="committee-create-organization"
              value={form.organization}
              onChange={(event) =>
                handleChange('organization', event.target.value)
              }
              placeholder="한국평가협회"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="committee-create-position">직위</Label>
            <Input
              id="committee-create-position"
              value={form.position}
              onChange={(event) => handleChange('position', event.target.value)}
              placeholder="수석심사위원"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="committee-create-field">분야</Label>
            <Input
              id="committee-create-field"
              value={form.field}
              onChange={(event) => handleChange('field', event.target.value)}
              placeholder="경영 전략"
            />
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
              {isSubmitting ? '등록 중...' : '추가하기'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
