"use client"

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type SessionApplicationItem = {
  id: string
  evaluationOrder: number
  status: string
  evaluatorState: 'not_started' | 'draft' | 'submitted' | 'signed'
  company: {
    id: string
    name: string
  }
}

function evaluatorStateLabel(state: SessionApplicationItem['evaluatorState']) {
  if (state === 'signed') {
    return '서명 완료'
  }

  if (state === 'submitted') {
    return '제출 완료'
  }

  if (state === 'draft') {
    return '작성 중'
  }

  return '미작성'
}

export default function EvalSessionApplicationsPage() {
  const params = useParams<{ sessionId: string }>()
  const router = useRouter()
  const sessionId = params.sessionId

  const [items, setItems] = useState<SessionApplicationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadApplications = async () => {
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch(`/api/eval/sessions/${sessionId}/applications`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? '신청 목록을 불러오지 못했습니다')
      }

      const data = (await response.json()) as { items: SessionApplicationItem[] }
      setItems(data.items)
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : '신청 목록을 불러오지 못했습니다',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadApplications()
  }, [sessionId])

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.evaluationOrder - b.evaluationOrder),
    [items],
  )

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">평가 대상 기업</h1>
        <p className="text-sm text-stone-600">기업을 선택하면 평가 화면으로 이동합니다.</p>
      </div>

      {error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>목록 로딩 실패</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" onClick={() => void loadApplications()}>
              다시 시도
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={`sk-${index}`} className="animate-pulse">
              <CardHeader>
                <CardTitle className="h-5 w-2/3 rounded bg-stone-200" />
                <CardDescription className="h-4 w-1/2 rounded bg-stone-100" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}

      {!isLoading && !error && sorted.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>평가 대상이 없습니다</CardTitle>
            <CardDescription>세션에 등록된 신청 기업이 없습니다.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!isLoading && !error && sorted.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {sorted.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => router.push(`/eval/sessions/${sessionId}/evaluate/${item.id}`)}
            >
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="line-clamp-1">{item.company.name}</CardTitle>
                  <Badge variant="outline">순번 {item.evaluationOrder}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm text-stone-600">
                  <span>상태: {item.status}</span>
                  <span className="font-medium text-stone-900">
                    {evaluatorStateLabel(item.evaluatorState)}
                  </span>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  )
}
