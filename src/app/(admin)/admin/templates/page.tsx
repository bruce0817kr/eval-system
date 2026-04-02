"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Edit, FileText, Plus, Trash2 } from 'lucide-react'

import { TemplateCreateDialog } from '@/components/admin/template-create-dialog'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { FormSchema } from '@/lib/form-template-schema'

type TemplateRow = {
  id: string
  name: string
  description: string | null
  isShared: boolean
  createdAt: string
  latestVersion: {
    id: string
    versionNumber: number
    totalScore: number
    itemsCount: number
    schemaJson: FormSchema
  } | null
}

export default function AdminTemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = React.useState<TemplateRow[]>([])
  const [search, setSearch] = React.useState('')
  const [sharedFilter, setSharedFilter] = React.useState<'all' | 'true' | 'false'>('all')
  const [isLoading, setIsLoading] = React.useState(true)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchTemplates = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()

      if (search.trim()) {
        params.set('search', search.trim())
      }

      if (sharedFilter !== 'all') {
        params.set('isShared', sharedFilter)
      }

      const response = await fetch(`/api/admin/templates?${params.toString()}`)

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        setError(payload.error ?? '템플릿 목록을 불러오지 못했습니다')
        return
      }

      const payload = (await response.json()) as { templates: TemplateRow[] }
      setTemplates(payload.templates)
    } catch {
      setError('템플릿 목록을 불러오지 못했습니다')
    } finally {
      setIsLoading(false)
    }
  }, [search, sharedFilter])

  React.useEffect(() => {
    void fetchTemplates()
  }, [fetchTemplates])

  async function handleDelete(templateId: string) {
    const response = await fetch(`/api/admin/templates/${templateId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string }
      setError(payload.error ?? '템플릿 삭제에 실패했습니다')
      return
    }

    await fetchTemplates()
  }

  async function handleCopy(template: TemplateRow) {
    try {
      const detailResponse = await fetch(`/api/admin/templates/${template.id}`)

      if (!detailResponse.ok) {
        const payload = (await detailResponse.json()) as { error?: string }
        setError(payload.error ?? '템플릿 복사에 실패했습니다')
        return
      }

      const detail = (await detailResponse.json()) as {
        versions: Array<{ schemaJson: FormSchema }>
      }

      const latestSchema = detail.versions[0]?.schemaJson

      if (!latestSchema) {
        setError('복사할 템플릿 버전을 찾을 수 없습니다')
        return
      }

      const createResponse = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${template.name}(복사본)`,
          description: template.description ?? undefined,
          isShared: false,
          schema: latestSchema,
        }),
      })

      if (!createResponse.ok) {
        const payload = (await createResponse.json()) as { error?: string }
        setError(payload.error ?? '템플릿 복사에 실패했습니다')
        return
      }

      await fetchTemplates()
    } catch {
      setError('템플릿 복사에 실패했습니다')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">평가표 템플릿</h1>
          <p className="text-sm text-muted-foreground">
            평가 기준과 문항 구성을 템플릿 단위로 관리합니다.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="size-4" /> 새 템플릿
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>템플릿 목록</CardTitle>
          <CardDescription>최신 버전 기준으로 템플릿 상태를 확인할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="템플릿명 또는 설명 검색"
            />

            <Select
              value={sharedFilter}
              onValueChange={(value) => {
                if (value === 'all' || value === 'true' || value === 'false') {
                  setSharedFilter(value)
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="공유 여부" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="true">공유</SelectItem>
                <SelectItem value="false">개인</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => void fetchTemplates()}>
              조회
            </Button>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {!isLoading && templates.length === 0 ? (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle>등록된 평가표 템플릿이 없습니다</CardTitle>
                <CardDescription>
                  기본 템플릿을 복사해서 기관별 평가 기준으로 커스터마이징하세요.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <FileText className="size-4" /> 기본 템플릿에서 시작
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {templates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>템플릿명</TableHead>
                  <TableHead>설명</TableHead>
                  <TableHead>최신버전</TableHead>
                  <TableHead>항목수</TableHead>
                  <TableHead>총점</TableHead>
                  <TableHead>공유여부</TableHead>
                  <TableHead>등록일</TableHead>
                  <TableHead>액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-muted-foreground">
                      {template.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        v{template.latestVersion?.versionNumber ?? '-'}
                      </Badge>
                    </TableCell>
                    <TableCell>{template.latestVersion?.itemsCount ?? 0}</TableCell>
                    <TableCell>{template.latestVersion?.totalScore ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={template.isShared ? 'default' : 'secondary'}>
                        {template.isShared ? '공유' : '개인'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(template.createdAt).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/admin/templates/${template.id}`)}
                        >
                          <Edit className="size-3.5" /> 편집
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleCopy(template)}
                        >
                          <Copy className="size-3.5" /> 복사
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
                            <Trash2 className="size-3.5" /> 삭제
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>템플릿을 삭제할까요?</AlertDialogTitle>
                              <AlertDialogDescription>
                                이미 회차에서 사용된 템플릿은 삭제할 수 없습니다.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>취소</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  void handleDelete(template.id)
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
          ) : null}
        </CardContent>
      </Card>

      <TemplateCreateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={() => void fetchTemplates()}
      />
    </div>
  )
}
