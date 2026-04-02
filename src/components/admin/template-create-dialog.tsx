"use client"

import * as React from 'react'

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
import { Textarea } from '@/components/ui/textarea'
import {
  getBlankTemplateSchema,
  getDefaultTemplateSchema,
  type FormSchema,
} from '@/lib/form-template-schema'

type TemplateCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

type StartMode = 'default' | 'blank'

export function TemplateCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: TemplateCreateDialogProps) {
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [startMode, setStartMode] = React.useState<StartMode>('default')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function getSchema() {
    if (startMode === 'blank') {
      return getBlankTemplateSchema()
    }

    try {
      const response = await fetch('/api/admin/templates/default')

      if (!response.ok) {
        return getDefaultTemplateSchema()
      }

      const data = (await response.json()) as { schema?: FormSchema }
      return data.schema ?? getDefaultTemplateSchema()
    } catch {
      return getDefaultTemplateSchema()
    }
  }

  async function handleCreate() {
    setError(null)

    if (!name.trim()) {
      setError('템플릿명을 입력해주세요')
      return
    }

    setIsSubmitting(true)

    try {
      const schema = await getSchema()
      const response = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          schema,
          isShared: false,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        setError(payload.error ?? '템플릿 생성 중 오류가 발생했습니다')
        return
      }

      setName('')
      setDescription('')
      setStartMode('default')
      onOpenChange(false)
      onCreated()
    } catch {
      setError('템플릿 생성 중 오류가 발생했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>새 템플릿</DialogTitle>
          <DialogDescription>
            기본 템플릿 또는 빈 템플릿으로 시작할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="template-name">템플릿명</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 2026 상반기 기술창업 평가표"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-description">설명</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="템플릿 목적과 사용 범위를 입력하세요"
            />
          </div>

          <div className="space-y-1.5">
            <Label>시작 방식</Label>
            <Select
              value={startMode}
              onValueChange={(value) => {
                if (value === 'default' || value === 'blank') {
                  setStartMode(value)
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="시작 방식을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">기본 템플릿 사용</SelectItem>
                <SelectItem value="blank">빈 템플릿</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleCreate} disabled={isSubmitting}>
            {isSubmitting ? '생성 중...' : '생성'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
