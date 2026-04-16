"use client"

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { ChevronLeft, ChevronRight, FileText, Minus, Plus } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'

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

type PdfState = {
  selectedDocumentId: string | null
  numPages: number
  currentPage: number
  scale: number
  loading: boolean
  loadError: string | null
  visiblePages: Set<number>
}

type PdfAction =
  | { type: 'SELECT_DOCUMENT'; documentId: string | null }
  | { type: 'SET_DOCUMENT'; documentId: string | null; url: string | null }
  | { type: 'LOAD_SUCCESS'; numPages: number }
  | { type: 'LOAD_ERROR'; error: string }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_PAGE'; page: number }
  | { type: 'SET_SCALE'; scale: number }
  | { type: 'ADD_VISIBLE_PAGE'; page: number }
  | { type: 'RESET' }

const initialState: PdfState = {
  selectedDocumentId: null,
  numPages: 0,
  currentPage: 1,
  scale: 1,
  loading: true,
  loadError: null,
  visiblePages: new Set([1]),
}

function pdfReducer(state: PdfState, action: PdfAction): PdfState {
  switch (action.type) {
    case 'SELECT_DOCUMENT':
      return {
        ...initialState,
        selectedDocumentId: action.documentId,
        loading: true,
        visiblePages: new Set([1]),
      }
    case 'LOAD_SUCCESS':
      return {
        ...state,
        numPages: action.numPages,
        loading: false,
        loadError: null,
        visiblePages: new Set([1, 2, 3]),
      }
    case 'LOAD_ERROR':
      return {
        ...state,
        loading: false,
        loadError: action.error,
      }
    case 'SET_LOADING':
      return { ...state, loading: action.loading }
    case 'SET_PAGE':
      return {
        ...state,
        currentPage: Math.max(1, Math.min(state.numPages, action.page)),
      }
    case 'SET_SCALE':
      return {
        ...state,
        scale: Math.max(0.6, Math.min(2, action.scale)),
      }
    case 'ADD_VISIBLE_PAGE':
      const newVisible = new Set(state.visiblePages)
      newVisible.add(action.page)
      return { ...state, visiblePages: newVisible }
    case 'RESET':
      return { ...initialState, selectedDocumentId: state.selectedDocumentId }
    default:
      return state
  }
}

export function PdfViewer({ documents }: PdfViewerProps) {
  const pdfDocs = useMemo(
    () => documents.filter((document) => document.mimeType.includes('pdf')),
    [documents],
  )

  const [state, dispatch] = useReducer(pdfReducer, {
    ...initialState,
    selectedDocumentId: pdfDocs[0]?.id ?? null,
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const lastTouchDistanceRef = useRef<number | null>(null)

  const currentDocument = pdfDocs.find((doc) => doc.id === state.selectedDocumentId) ?? null

  const handleDocumentSelect = useCallback((documentId: string | null) => {
    if (documentId) {
      dispatch({ type: 'SELECT_DOCUMENT', documentId })
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        lastTouchDistanceRef.current = Math.sqrt(dx * dx + dy * dy)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastTouchDistanceRef.current !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const distance = Math.sqrt(dx * dx + dy * dy)
        const delta = distance - lastTouchDistanceRef.current

        if (Math.abs(delta) > 1) {
          dispatch({ type: 'SET_SCALE', scale: state.scale + (delta > 0 ? 0.05 : -0.05) })
          lastTouchDistanceRef.current = distance
          e.preventDefault()
        }
      }
    }

    const handleTouchEnd = () => {
      lastTouchDistanceRef.current = null
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [state.scale])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        dispatch({ type: 'SET_PAGE', page: state.currentPage - 1 })
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        dispatch({ type: 'SET_PAGE', page: state.currentPage + 1 })
      }
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('keydown', handleKeyDown)
      return () => container.removeEventListener('keydown', handleKeyDown)
    }
  }, [state.currentPage, state.numPages])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = Number(entry.target.getAttribute('data-page-number'))
            if (!isNaN(pageNum)) {
              dispatch({ type: 'ADD_VISIBLE_PAGE', page: pageNum })
            }
          }
        })
      },
      { root: containerRef.current, rootMargin: '100px', threshold: 0 },
    )

    pageRefs.current.forEach((element) => {
      observer.observe(element)
    })

    return () => observer.disconnect()
  }, [state.numPages])

  const scrollToPage = useCallback((pageNum: number) => {
    const element = pageRefs.current.get(pageNum)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const handlePageChange = useCallback(
    (newPage: number) => {
      dispatch({ type: 'SET_PAGE', page: newPage })
      setTimeout(() => scrollToPage(newPage), 0)
    },
    [scrollToPage],
  )

  const setPageRef = useCallback((pageNum: number, el: HTMLDivElement | null) => {
    if (el) {
      pageRefs.current.set(pageNum, el)
    } else {
      pageRefs.current.delete(pageNum)
    }
  }, [])

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
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="shrink-0 space-y-3 border-b">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FileText className="size-4" />
            {currentDocument?.originalFilename ?? '문서 선택'}
          </CardTitle>

          {state.numPages > 0 && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => handlePageChange(state.currentPage - 1)}
                disabled={state.currentPage <= 1}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={state.numPages}
                  value={state.currentPage}
                  onChange={(e) => handlePageChange(Number(e.target.value))}
                  className="h-7 w-12 rounded-md border text-center text-xs"
                />
                <span className="text-xs text-stone-500">/ {state.numPages}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => handlePageChange(state.currentPage + 1)}
                disabled={state.currentPage >= state.numPages}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => dispatch({ type: 'SET_SCALE', scale: state.scale - 0.1 })}
            >
              <Minus className="size-4" />
            </Button>
            <div className="w-16 text-center text-xs text-stone-600">
              {Math.round(state.scale * 100)}%
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => dispatch({ type: 'SET_SCALE', scale: state.scale + 0.1 })}
            >
              <Plus className="size-4" />
            </Button>
          </div>

          <Select
            value={state.selectedDocumentId ?? undefined}
            onValueChange={handleDocumentSelect}
          >
            <SelectTrigger className="w-full max-w-[200px]">
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
        </div>

        <div className="flex flex-wrap gap-1.5">
          {pdfDocs.map((document) => (
            <Button
              key={document.id}
              type="button"
              variant={document.id === state.selectedDocumentId ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleDocumentSelect(document.id)}
            >
              {document.originalFilename}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent
        ref={containerRef}
        className="flex-1 overflow-auto bg-stone-50 p-3"
      >
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
              dispatch({ type: 'LOAD_SUCCESS', numPages: pdf.numPages })
            }}
            onLoadError={() => {
              dispatch({ type: 'LOAD_ERROR', error: 'PDF를 불러오지 못했습니다' })
            }}
          >
            {state.loadError ? (
              <div className="flex h-[360px] items-center justify-center rounded-md border bg-white text-sm text-destructive">
                {state.loadError}
              </div>
            ) : null}

            {!state.loadError && state.loading ? (
              <div className="space-y-3">
                <Skeleton className="h-[420px] w-full" />
                <Skeleton className="h-[420px] w-full" />
              </div>
            ) : null}

            {!state.loadError && !state.loading && state.numPages > 0 && (
              <div className="space-y-3">
                {Array.from({ length: state.numPages }).map((_, index) => {
                  const pageNum = index + 1
                  const isVisible = state.visiblePages.has(pageNum)
                  const isCurrentPage = pageNum === state.currentPage

                  return (
                    <div
                      key={`page-${pageNum}`}
                      ref={(el) => setPageRef(pageNum, el)}
                      data-page-number={pageNum}
                      className={`overflow-hidden rounded-md border bg-white p-2 shadow-sm transition-colors ${
                        isCurrentPage ? 'ring-2 ring-primary ring-offset-2' : ''
                      }`}
                    >
                      {isVisible ? (
                        <Page
                          pageNumber={pageNum}
                          scale={state.scale}
                          renderAnnotationLayer={false}
                          renderTextLayer
                          loading={<Skeleton className="h-[420px] w-full" />}
                        />
                      ) : (
                        <Skeleton className="h-[420px] w-full" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Document>
        )}
      </CardContent>
    </Card>
  )
}
