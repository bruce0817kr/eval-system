"use client"

import { useMemo, useState } from 'react'
import { FileText, Minus, Plus } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

type PdfDocumentItem = {
  id: string
  originalFilename: string
  mimeType: string
  url: string | null
}

type PdfViewerProps = {
  documents: PdfDocumentItem[]
}

export function PdfViewer({ documents }: PdfViewerProps) {
  const pdfDocs = useMemo(
    () => documents.filter((document) => document.mimeType.includes('pdf')),
    [documents],
  )
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(pdfDocs[0]?.id ?? null)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const currentDocument = pdfDocs.find((document) => document.id === selectedDocumentId) ?? null

  if (!pdfDocs.length) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full min-h-[320px] items-center justify-center text-sm text-stone-500">
          PDF 문서가 없습니다.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="space-y-3 border-b">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FileText className="size-4" />
            {currentDocument?.originalFilename ?? '문서 선택'}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="outline" size="icon-sm" onClick={() => setScale((prev) => Math.max(0.6, prev - 0.1))}>
              <Minus className="size-4" />
            </Button>
            <div className="w-16 text-center text-xs text-stone-600">{Math.round(scale * 100)}%</div>
            <Button type="button" variant="outline" size="icon-sm" onClick={() => setScale((prev) => Math.min(2, prev + 0.1))}>
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        <Select
          value={selectedDocumentId}
          onValueChange={(value) => {
            if (!value) {
              return
            }

            setSelectedDocumentId(value)
            setNumPages(0)
            setLoadError(null)
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="문서를 선택하세요" />
          </SelectTrigger>
          <SelectContent>
            {pdfDocs.map((document) => (
              <SelectItem key={document.id} value={document.id}>
                {document.originalFilename}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="h-[calc(100%-110px)] overflow-auto bg-stone-50 p-3">
        {!currentDocument?.url ? (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-md border border-dashed bg-white text-sm text-stone-500">
            문서 URL을 불러오지 못했습니다.
          </div>
        ) : (
          <Document
            file={currentDocument.url}
            loading={
              <div className="space-y-3">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-[420px] w-full" />
              </div>
            }
            onLoadSuccess={(pdf) => {
              setNumPages(pdf.numPages)
              setLoading(false)
            }}
            onLoadError={() => {
              setLoadError('PDF를 불러오지 못했습니다')
              setLoading(false)
            }}
          >
            {loadError ? (
              <div className="flex h-[360px] items-center justify-center rounded-md border bg-white text-sm text-destructive">
                {loadError}
              </div>
            ) : null}

            {!loadError && loading ? (
              <div className="space-y-3">
                <Skeleton className="h-[420px] w-full" />
                <Skeleton className="h-[420px] w-full" />
              </div>
            ) : null}

            {!loadError && numPages > 0 ? (
              <div className="space-y-3">
                {Array.from({ length: numPages }).map((_, index) => (
                  <div key={`page-${index + 1}`} className="overflow-hidden rounded-md border bg-white p-2 shadow-sm">
                    <Page
                      pageNumber={index + 1}
                      scale={scale}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </Document>
        )}
      </CardContent>
    </Card>
  )
}
