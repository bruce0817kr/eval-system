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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type CommitteeImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

type ImportMemberInput = {
  name: string
  phone: string
  organization?: string
  position?: string
  field?: string
}

type ImportResult = {
  success: number
  errors: Array<{ index: number; message: string }>
}

const TEMPLATE_JSON = JSON.stringify(
  [
    {
      name: '홍길동',
      phone: '010-1234-5678',
      organization: '한국평가협회',
      position: '수석심사위원',
      field: '경영 전략',
    },
  ],
  null,
  2,
)

function parseLine(line: string): ImportMemberInput | null {
  const trimmed = line.trim()

  if (!trimmed) {
    return null
  }

  const separator = trimmed.includes('\t') ? '\t' : ','
  const [name, phone, organization, position, field] = trimmed
    .split(separator)
    .map((value) => value.trim())

  if (!name || !phone) {
    return null
  }

  return {
    name,
    phone,
    organization,
    position,
    field,
  }
}

function parseMembers(input: string): ImportMemberInput[] {
  const trimmed = input.trim()

  if (!trimmed) {
    return []
  }

  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as unknown

    if (!Array.isArray(parsed)) {
      throw new Error('JSON 배열 형식이어야 합니다')
    }

    return parsed.map((item) => item as ImportMemberInput)
  }

  return trimmed.split('\n').map(parseLine).filter((item): item is ImportMemberInput => item !== null)
}

export function CommitteeImportDialog({
  open,
  onOpenChange,
  onImported,
}: CommitteeImportDialogProps) {
  const [inputValue, setInputValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_JSON], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = url
    anchor.download = 'committee-members-template.json'
    anchor.click()

    URL.revokeObjectURL(url)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setResult(null)
    setIsSubmitting(true)

    try {
      const members = parseMembers(inputValue)

      if (members.length === 0) {
        setErrorMessage('등록할 위원 데이터를 입력해주세요')
        return
      }

      const response = await fetch('/api/admin/committee/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ members }),
      })

      const payload = (await response.json()) as
        | ImportResult
        | { error?: string }

      if (!response.ok) {
        setErrorMessage(
          'error' in payload
            ? (payload.error ?? '일괄 등록에 실패했습니다')
            : '일괄 등록에 실패했습니다',
        )
        return
      }

      setResult(payload as ImportResult)
      onImported()
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage('일괄 등록 중 오류가 발생했습니다')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>평가위원 일괄 등록</DialogTitle>
          <DialogDescription>
            JSON 배열 또는 줄 단위 텍스트(이름,연락처,소속,직위,분야)로 등록할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between">
            <Label htmlFor="committee-import-textarea">입력 데이터</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={downloadTemplate}
            >
              템플릿 다운로드
            </Button>
          </div>

          <Textarea
            id="committee-import-textarea"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            className="min-h-64"
            placeholder={TEMPLATE_JSON}
          />

          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}

          {result && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <p>
                등록 성공: <span className="font-medium">{result.success}</span>건
              </p>
              {result.errors.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {result.errors.map((error) => (
                    <li key={`${error.index}-${error.message}`}>
                      {error.index + 1}행: {error.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              닫기
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '등록 중...' : '일괄 등록'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
