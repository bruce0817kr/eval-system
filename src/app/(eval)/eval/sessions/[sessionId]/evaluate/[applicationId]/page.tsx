"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { EvaluationForm } from '@/components/eval/evaluation-form'
import { PdfViewer } from '@/components/eval/pdf-viewer'
import { SignatureSubmitDialog } from '@/components/eval/signature-submit-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { type FormSchema, formSchemaSchema } from '@/lib/form-template-schema'

type LoadResponse = {
  application: {
    id: string
    evaluationOrder: number
    status: string
    company: {
      id: string
      name: string
    }
    documents: {
      id: string
      originalFilename: string
      mimeType: string
      url: string | null
    }[]
  }
  formDefinition: {
    schemaJson: unknown
    totalScore: number
    itemsCount: number
  }
  draft: {
    answersJson: Record<string, unknown>
    version: number
    lastSavedAt: string
  } | null
  submission: {
    id: string
    submissionState: string
    answersJson: Record<string, unknown>
  } | null
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function EvalApplicationEvaluatePage() {
  const params = useParams<{ sessionId: string; applicationId: string }>()
  const router = useRouter()

  const sessionId = params.sessionId
  const applicationId = params.applicationId

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [documents, setDocuments] = useState<LoadResponse['application']['documents']>([])
  const [schema, setSchema] = useState<FormSchema | null>(null)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [version, setVersion] = useState(0)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [isSaving, setIsSaving] = useState(false)
  const [isSigned, setIsSigned] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [evaluatorName, setEvaluatorName] = useState('')
  const [evaluatorPhone, setEvaluatorPhone] = useState('')
  const [activeTab, setActiveTab] = useState<'pdf' | 'form'>('pdf')

  const answersRef = useRef<Record<string, unknown>>({})
  const versionRef = useRef(0)
  const dirtyRef = useRef(false)
  const blurTimerRef = useRef<number | null>(null)

  const loadInitial = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [detailResponse, meResponse] = await Promise.all([
        fetch(`/api/eval/sessions/${sessionId}/applications/${applicationId}`, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
        }),
        fetch('/api/eval/me', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
        }),
      ])

      if (!detailResponse.ok) {
        const detailError = (await detailResponse.json().catch(() => null)) as
          | { error?: string }
          | null
        throw new Error(detailError?.error ?? '평가 정보를 불러오지 못했습니다')
      }

      const detail = (await detailResponse.json()) as LoadResponse

      if (meResponse.ok) {
        const meData = (await meResponse.json()) as { name: string; phone: string }
        setEvaluatorName(meData.name)
        setEvaluatorPhone(meData.phone)
      }

      const parsedSchema = formSchemaSchema.safeParse(detail.formDefinition.schemaJson)

      if (!parsedSchema.success) {
        throw new Error('평가표 스키마가 올바르지 않습니다')
      }

      const initialAnswers = detail.draft?.answersJson ?? detail.submission?.answersJson ?? {}
      const initialVersion = detail.draft?.version ?? 0

      setCompanyName(detail.application.company.name)
      setDocuments(detail.application.documents)
      setSchema(parsedSchema.data)
      setAnswers(initialAnswers)
      setVersion(initialVersion)
      setIsSigned(detail.submission?.submissionState === 'signed')
      answersRef.current = initialAnswers
      versionRef.current = initialVersion
      dirtyRef.current = false
      setSaveStatus('idle')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '평가 정보를 불러오지 못했습니다')
    } finally {
      setIsLoading(false)
    }
  }, [applicationId, sessionId])

  useEffect(() => {
    void loadInitial()
  }, [loadInitial])

  const saveDraft = useCallback(async () => {
    if (isSaving || !dirtyRef.current) {
      return
    }

    setIsSaving(true)
    setSaveStatus('saving')

    try {
      const response = await fetch(`/api/eval/sessions/${sessionId}/drafts`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          applicationId,
          answersJson: answersRef.current,
          version: versionRef.current,
        }),
      })

      if (response.status === 409) {
        const conflict = (await response.json()) as {
          conflict?: { draft?: { answersJson: Record<string, unknown>; version: number } }
        }

        if (conflict.conflict?.draft) {
          setAnswers(conflict.conflict.draft.answersJson)
          setVersion(conflict.conflict.draft.version)
          answersRef.current = conflict.conflict.draft.answersJson
          versionRef.current = conflict.conflict.draft.version
          dirtyRef.current = false
        }

        setSaveStatus('error')
        setError('다른 기기에서 수정되어 최신 초안으로 동기화했습니다.')
        return
      }

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? '초안 저장에 실패했습니다')
      }

      const data = (await response.json()) as {
        draft: { answersJson: Record<string, unknown>; version: number }
      }

      setAnswers(data.draft.answersJson)
      setVersion(data.draft.version)
      answersRef.current = data.draft.answersJson
      versionRef.current = data.draft.version
      dirtyRef.current = false
      setSaveStatus('saved')
    } catch (saveError) {
      setSaveStatus('error')
      setError(saveError instanceof Error ? saveError.message : '초안 저장에 실패했습니다')
    } finally {
      setIsSaving(false)
    }
  }, [applicationId, isSaving, sessionId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void saveDraft()
    }, 30_000)

    return () => {
      window.clearInterval(timer)
    }
  }, [saveDraft])

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) {
        window.clearTimeout(blurTimerRef.current)
      }
    }
  }, [])

  const handleAnswerChange = (itemId: string, value: unknown) => {
    setAnswers((previous) => {
      const next = {
        ...previous,
        [itemId]: value,
      }
      answersRef.current = next
      dirtyRef.current = true
      setSaveStatus('idle')
      return next
    })
  }

  const handleFieldBlur = () => {
    if (blurTimerRef.current) {
      window.clearTimeout(blurTimerRef.current)
    }

    blurTimerRef.current = window.setTimeout(() => {
      void saveDraft()
    }, 2_000)
  }

  const completedCount = useMemo(() => {
    if (!schema) {
      return 0
    }

    const editableItems = schema.sections.flatMap((section) =>
      section.items.filter((item) => item.type === 'text' || item.type === 'radio_score'),
    )

    return editableItems.filter((item) => {
      const answer = answers[item.id]
      if (item.type === 'text') {
        return typeof answer === 'string' && answer.trim().length > 0
      }

      return typeof answer === 'number'
    }).length
  }, [answers, schema])

  const totalCount = useMemo(() => {
    if (!schema) {
      return 0
    }

    return schema.sections.flatMap((section) =>
      section.items.filter((item) => item.type === 'text' || item.type === 'radio_score'),
    ).length
  }, [schema])

  if (isLoading) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="py-10 text-center text-sm text-stone-500">
            평가 화면을 불러오는 중...
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !schema) {
    return (
      <div className="p-4 md:p-6">
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>평가 화면 로딩 실패</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-destructive">{error ?? '알 수 없는 오류가 발생했습니다'}</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => void loadInitial()}>
                다시 시도
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.back()}>
                이전으로
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100svh-3.5rem)] flex-col p-2 md:p-3">
      <div className="mb-2 flex items-center justify-between rounded-md border bg-white px-3 py-2">
        <div className="space-y-1">
          <p className="text-sm text-stone-500">평가 대상 기업</p>
          <h1 className="text-lg font-semibold text-stone-900">{companyName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">작성 {completedCount}/{totalCount}</Badge>
          <Badge variant={isSigned ? 'default' : 'secondary'}>{isSigned ? '서명 완료' : '작성 중'}</Badge>
        </div>
      </div>

      {/* Mobile Tab Switcher */}
      <div className="mb-2 flex gap-1 md:hidden">
        <button
          type="button"
          onClick={() => setActiveTab('pdf')}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'pdf'
              ? 'bg-primary text-primary-foreground'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          PDF 문서
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('form')}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'form'
              ? 'bg-primary text-primary-foreground'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          평가표
        </button>
      </div>

      {/* Desktop: Side-by-side | Mobile: Tab-based */}
      <div className="flex-1 overflow-hidden rounded-lg border bg-white">
        {/* Desktop Layout */}
        <ResizablePanelGroup orientation="horizontal" className="hidden h-full md:flex">
          <ResizablePanel defaultSize={70} minSize={40}>
            <PdfViewer documents={documents} />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={30} minSize={28}>
            <EvaluationForm
              schema={schema}
              answers={answers}
              onAnswerChange={handleAnswerChange}
              onFieldBlur={handleFieldBlur}
              onSaveDraft={() => void saveDraft()}
              onSubmit={() => setDialogOpen(true)}
              saveStatus={saveStatus}
              isSaving={isSaving}
              isSubmitDisabled={isSigned}
            />
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Mobile Layout */}
        <div className="flex h-full flex-col md:hidden">
          <div className={`flex-1 overflow-hidden ${activeTab === 'pdf' ? 'block' : 'hidden'}`}>
            <PdfViewer documents={documents} />
          </div>
          <div className={`flex-1 overflow-hidden ${activeTab === 'form' ? 'block' : 'hidden'}`}>
            <EvaluationForm
              schema={schema}
              answers={answers}
              onAnswerChange={handleAnswerChange}
              onFieldBlur={handleFieldBlur}
              onSaveDraft={() => void saveDraft()}
              onSubmit={() => setDialogOpen(true)}
              saveStatus={saveStatus}
              isSaving={isSaving}
              isSubmitDisabled={isSigned}
            />
          </div>
        </div>
      </div>

      <SignatureSubmitDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sessionId={sessionId}
        applicationId={applicationId}
        schema={schema}
        answers={answers}
        evaluatorName={evaluatorName}
        evaluatorPhone={evaluatorPhone}
        onSigned={() => {
          setIsSigned(true)
          setSaveStatus('saved')
        }}
      />
    </div>
  )
}
