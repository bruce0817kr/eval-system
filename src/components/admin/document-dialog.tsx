'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { DownloadIcon, FileTextIcon, Trash2Icon, UploadIcon } from 'lucide-react'

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type DocumentItem = {
  id: string
  docType: 'business_plan' | 'supplementary'
  originalFilename: string
  fileSize: number
  uploadedAt: string
}

type Props = {
  sessionId: string
  applicationId: string
  companyName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DOC_TYPE_LABEL: Record<string, string> = {
  business_plan: '사업계획서',
  supplementary: '보완서류',
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentDialog({
  sessionId,
  applicationId,
  companyName,
  open,
  onOpenChange,
}: Props) {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingDocTypeRef = useRef<'business_plan' | 'supplementary'>('business_plan')

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/sessions/${sessionId}/applications/${applicationId}/documents`,
      )
      if (!res.ok) {
        setError('서류 목록을 불러오지 못했습니다')
        return
      }
      const data = (await res.json()) as { documents: DocumentItem[] }
      setDocuments(data.documents)
    } finally {
      setLoading(false)
    }
  }, [sessionId, applicationId])

  useEffect(() => {
    if (open) void fetchDocuments()
  }, [open, fetchDocuments])

  async function handleUpload(file: File, docType: 'business_plan' | 'supplementary') {
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('docType', docType)
      const res = await fetch(
        `/api/admin/sessions/${sessionId}/applications/${applicationId}/documents`,
        { method: 'POST', body: form },
      )
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        setError(body.error ?? '업로드에 실패했습니다')
        return
      }
      await fetchDocuments()
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(documentId: string) {
    const res = await fetch(
      `/api/admin/sessions/${sessionId}/applications/${applicationId}/documents/${documentId}`,
    )
    if (!res.ok) return
    const data = (await res.json()) as { url: string; originalFilename: string }
    const a = document.createElement('a')
    a.href = data.url
    a.download = data.originalFilename
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.click()
  }

  async function handleDelete(documentId: string) {
    setDeletingId(documentId)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/sessions/${sessionId}/applications/${applicationId}/documents?documentId=${documentId}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        setError(body.error ?? '삭제에 실패했습니다')
        return
      }
      await fetchDocuments()
    } finally {
      setDeletingId(null)
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    void handleUpload(file, pendingDocTypeRef.current)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>서류 관리</DialogTitle>
          <DialogDescription>{companyName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={onFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => { pendingDocTypeRef.current = 'business_plan'; fileInputRef.current?.click() }}
            >
              <UploadIcon className="size-4" />
              사업계획서 업로드
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => { pendingDocTypeRef.current = 'supplementary'; fileInputRef.current?.click() }}
            >
              <UploadIcon className="size-4" />
              보완서류 업로드
            </Button>
            {uploading && <span className="self-center text-sm text-muted-foreground">업로드 중...</span>}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">불러오는 중...</p>
          ) : documents.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <FileTextIcon className="mx-auto mb-2 size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">업로드된 서류가 없습니다</p>
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 px-3 py-2">
                  <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.originalFilename}</p>
                    <p className="text-xs text-muted-foreground">
                      {DOC_TYPE_LABEL[doc.docType]} · {formatFileSize(doc.fileSize)} ·{' '}
                      {new Date(doc.uploadedAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {DOC_TYPE_LABEL[doc.docType]}
                  </Badge>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => void handleDownload(doc.id)}
                    aria-label="서류 다운로드"
                    title="다운로드"
                  >
                    <DownloadIcon className="size-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          disabled={deletingId === doc.id}
                          aria-label="서류 삭제"
                        />
                      }
                    >
                      <Trash2Icon className="size-4 text-destructive" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>서류를 삭제할까요?</AlertDialogTitle>
                        <AlertDialogDescription>
                          삭제 후 복구할 수 없습니다.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => void handleDelete(doc.id)}
                        >
                          삭제
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
