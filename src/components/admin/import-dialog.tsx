'use client'

import { useRef, useState } from 'react'
import { FileSpreadsheet, UploadCloud } from 'lucide-react'

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
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'

type ImportError = {
  rowNumber: number
  errorMessage: string
}

type PreviewRow = {
  rowNumber: number
  valid: boolean
  data: Record<string, unknown>
  errorMessage?: string
}

type ImportResponse = {
  batchId: string | null
  totalRows: number
  successCount: number
  errorCount: number
  preview?: PreviewRow[]
  errors: ImportError[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  onImported?: () => void
}

export function ImportDialog({ open, onOpenChange, sessionId, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [preview, setPreview] = useState<ImportResponse | null>(null)
  const [result, setResult] = useState<ImportResponse | null>(null)

  function resetState() {
    setSelectedFile(null)
    setUploading(false)
    setProgress(0)
    setPreview(null)
    setResult(null)
  }

  function onPickFile(file: File) {
    const valid = /\.(csv|xlsx|xls)$/i.test(file.name)

    if (!valid) {
      return
    }

    setSelectedFile(file)
    setPreview(null)
    setResult(null)
  }

  async function requestPreview(file: File) {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`/api/admin/sessions/${sessionId}/import?preview=true`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      return
    }

    const data = (await response.json()) as ImportResponse
    setPreview(data)
  }

  async function upload() {
    if (!selectedFile) {
      return
    }

    setUploading(true)
    setProgress(15)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      setProgress(40)

      const response = await fetch(`/api/admin/sessions/${sessionId}/import`, {
        method: 'POST',
        body: formData,
      })

      setProgress(85)

      if (!response.ok) {
        return
      }

      const data = (await response.json()) as ImportResponse
      setResult(data)
      setProgress(100)
      onImported?.()
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) {
          resetState()
        }
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>CSV/Excel 일괄 가져오기</DialogTitle>
          <DialogDescription>
            기업명(필수), 대표자명, 사업자등록번호, 주소, 전화, 이메일, 업종, 설립일 컬럼을 지원합니다.
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center hover:bg-muted/30"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            const file = event.dataTransfer.files.item(0)
            if (file) {
              onPickFile(file)
              void requestPreview(file)
            }
          }}
        >
          <UploadCloud className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">파일을 드래그하거나 클릭해 선택하세요</p>
          <p className="text-xs text-muted-foreground">지원 형식: .csv, .xlsx, .xls</p>
        </button>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".csv,.xlsx,.xls"
          onChange={(event) => {
            const file = event.target.files?.item(0)
            if (!file) {
              return
            }

            onPickFile(file)
            void requestPreview(file)
          }}
        />

        {selectedFile ? (
          <div className="rounded-md border p-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="size-4" />
              <p className="text-sm font-medium">{selectedFile.name}</p>
              <Badge variant="outline">{Math.ceil(selectedFile.size / 1024)} KB</Badge>
            </div>
          </div>
        ) : null}

        {uploading ? <Progress value={progress} /> : null}

        {preview ? (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">미리보기 (최대 10행)</p>
            <div className="flex gap-2 text-xs">
              <Badge variant="secondary">총 {preview.totalRows}행</Badge>
              <Badge className="bg-emerald-600 text-white">성공 {preview.successCount}</Badge>
              <Badge variant="destructive">오류 {preview.errorCount}</Badge>
            </div>
            <ScrollArea className="h-36 rounded-md border p-2">
              <div className="space-y-2">
                {preview.preview?.map((row) => (
                  <div key={row.rowNumber} className="rounded border p-2 text-xs">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant={row.valid ? 'secondary' : 'destructive'}>
                        {row.rowNumber}행
                      </Badge>
                      {!row.valid ? <span>{row.errorMessage}</span> : null}
                    </div>
                    <pre className="whitespace-pre-wrap break-all text-[11px] text-muted-foreground">
                      {JSON.stringify(row.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : null}

        {result ? (
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span>가져오기 결과</span>
              <Badge variant="outline">Batch: {result.batchId ?? '-'}</Badge>
            </div>
            <div className="flex gap-2 text-xs">
              <Badge variant="secondary">총 {result.totalRows}행</Badge>
              <Badge className="bg-emerald-600 text-white">성공 {result.successCount}</Badge>
              <Badge variant="destructive">오류 {result.errorCount}</Badge>
            </div>
            {result.errors.length > 0 ? (
              <ScrollArea className="h-32 rounded-md border p-2">
                <ul className="space-y-1 text-xs">
                  {result.errors.map((error, index) => (
                    <li key={`${error.rowNumber}-${index}`} className="text-destructive">
                      {error.rowNumber}행: {error.errorMessage}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            ) : (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-700">
                모든 행이 정상 처리되었습니다.
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
          <Button onClick={upload} disabled={!selectedFile || uploading}>
            {uploading ? '업로드 중...' : '가져오기 실행'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
