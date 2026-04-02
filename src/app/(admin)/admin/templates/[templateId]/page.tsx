"use client"

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'

import { TemplateFormEditor } from '@/components/admin/template-form-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  type FormSchema,
  formSchemaSchema,
  validateSchemaForSave,
} from '@/lib/form-template-schema'

type VersionDto = {
  id: string
  versionNumber: number
  schemaJson: FormSchema
  totalScore: number
  itemsCount: number
  createdAt: string
}

type TemplateDto = {
  id: string
  name: string
  description: string | null
  isShared: boolean
  versions: VersionDto[]
}

export default function AdminTemplateEditorPage() {
  const router = useRouter()
  const params = useParams<{ templateId: string }>()
  const templateId = params.templateId

  const [template, setTemplate] = React.useState<TemplateDto | null>(null)
  const [selectedVersionId, setSelectedVersionId] = React.useState<string>('')
  const [schema, setSchema] = React.useState<FormSchema | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchTemplate = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/templates/${templateId}`)

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        setError(payload.error ?? '템플릿을 불러오지 못했습니다')
        return
      }

      const data = (await response.json()) as TemplateDto
      setTemplate(data)

      const latest = data.versions[0]
      setSelectedVersionId(latest?.id ?? '')
      setSchema(latest?.schemaJson ?? null)
    } catch {
      setError('템플릿을 불러오지 못했습니다')
    } finally {
      setIsLoading(false)
    }
  }, [templateId])

  React.useEffect(() => {
    if (!templateId) {
      return
    }

    void fetchTemplate()
  }, [fetchTemplate, templateId])

  const selectedVersion = React.useMemo(
    () => template?.versions.find((version) => version.id === selectedVersionId),
    [selectedVersionId, template],
  )

  async function handleSaveVersion() {
    if (!schema || !template) {
      return
    }

    setError(null)

    const parsed = formSchemaSchema.safeParse(schema)

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '스키마 형식이 올바르지 않습니다')
      return
    }

    const validation = validateSchemaForSave(schema)

    if (!validation.valid) {
      setError(validation.errors[0] ?? '저장할 수 없는 스키마입니다')
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch(`/api/admin/templates/${template.id}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ schema }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        setError(payload.error ?? '버전 저장에 실패했습니다')
        return
      }

      const created = (await response.json()) as VersionDto
      const nextTemplate: TemplateDto = {
        ...template,
        versions: [created, ...template.versions],
      }

      setTemplate(nextTemplate)
      setSelectedVersionId(created.id)
    } catch {
      setError('버전 저장에 실패했습니다')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">템플릿을 불러오는 중...</p>
  }

  if (!template || !schema) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <p className="text-sm text-destructive">{error ?? '템플릿을 찾을 수 없습니다'}</p>
          <Button variant="outline" onClick={() => router.push('/admin/templates')}>
            목록으로 이동
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{template.name}</h1>
          <p className="text-sm text-muted-foreground">
            버전을 선택해 이전 스냅샷을 확인하거나 새 버전으로 저장할 수 있습니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={selectedVersionId}
            onValueChange={(value) => {
              if (!value) {
                return
              }

              setSelectedVersionId(value)
              const target = template.versions.find((version) => version.id === value)

              if (target) {
                setSchema(target.schemaJson)
              }
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="버전 선택" />
            </SelectTrigger>
            <SelectContent>
              {template.versions.map((version) => (
                <SelectItem key={version.id} value={version.id}>
                  v{version.versionNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => void handleSaveVersion()} disabled={isSaving}>
            {isSaving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">현재 버전 v{selectedVersion?.versionNumber ?? '-'}</Badge>
        <Separator orientation="vertical" className="h-4" />
        <span>항목 수 {selectedVersion?.itemsCount ?? 0}</span>
        <Separator orientation="vertical" className="h-4" />
        <span>총점 {selectedVersion?.totalScore ?? 0}</span>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <TemplateFormEditor schema={schema} onChange={setSchema} />
    </div>
  )
}
