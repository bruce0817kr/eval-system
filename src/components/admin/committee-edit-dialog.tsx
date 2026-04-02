'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { Badge } from '@/components/ui/badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type CommitteeMemberItem = {
  id: string
  name: string
  phone: string
  organization: string | null
  position: string | null
  field: string | null
  isActive: boolean
}

type CommitteeEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: CommitteeMemberItem | null
  onUpdated: () => void
}

type EditFormState = {
  name: string
  phone: string
  organization: string
  position: string
  field: string
  isActive: 'true' | 'false'
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

function toFormState(member: CommitteeMemberItem): EditFormState {
  return {
    name: member.name,
    phone: member.phone,
    organization: member.organization ?? '',
    position: member.position ?? '',
    field: member.field ?? '',
    isActive: member.isActive ? 'true' : 'false',
  }
}

export function CommitteeEditDialog({
  open,
  onOpenChange,
  member,
  onUpdated,
}: CommitteeEditDialogProps) {
  const [form, setForm] = useState<EditFormState | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (member) {
      setForm(toFormState(member))
    }
  }, [member])

  const statusBadge = useMemo(() => {
    if (!form) {
      return null
    }

    return form.isActive === 'true' ? (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
        활성
      </Badge>
    ) : (
      <Badge variant="secondary">비활성</Badge>
    )
  }, [form])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!member || !form) {
      return
    }

    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/admin/committee/${member.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          isActive: form.isActive === 'true',
        }),
      })

      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        setErrorMessage(result.error ?? '위원 정보 수정에 실패했습니다')
        return
      }

      onOpenChange(false)
      onUpdated()
    } catch {
      setErrorMessage('위원 정보 수정 중 오류가 발생했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!member || !form) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>평가위원 수정</span>
            {statusBadge}
          </DialogTitle>
          <DialogDescription>
            위원 기본 정보와 활성 상태를 수정합니다.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="committee-edit-name">이름</Label>
            <Input
              id="committee-edit-name"
              value={form.name}
              onChange={(event) =>
                setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        name: event.target.value,
                      }
                    : prev,
                )
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="committee-edit-phone">연락처</Label>
            <Input
              id="committee-edit-phone"
              value={form.phone}
              onChange={(event) =>
                setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        phone: formatPhoneInput(event.target.value),
                      }
                    : prev,
                )
              }
              inputMode="numeric"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="committee-edit-organization">소속</Label>
            <Input
              id="committee-edit-organization"
              value={form.organization}
              onChange={(event) =>
                setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        organization: event.target.value,
                      }
                    : prev,
                )
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="committee-edit-position">직위</Label>
            <Input
              id="committee-edit-position"
              value={form.position}
              onChange={(event) =>
                setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        position: event.target.value,
                      }
                    : prev,
                )
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="committee-edit-field">분야</Label>
            <Input
              id="committee-edit-field"
              value={form.field}
              onChange={(event) =>
                setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        field: event.target.value,
                      }
                    : prev,
                )
              }
            />
          </div>

          <div className="space-y-2">
            <Label>상태</Label>
            <Select
              value={form.isActive}
              onValueChange={(value) =>
                setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        isActive: value === 'false' ? 'false' : 'true',
                      }
                    : prev,
                )
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="상태 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">활성</SelectItem>
                <SelectItem value="false">비활성</SelectItem>
              </SelectContent>
            </Select>
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
