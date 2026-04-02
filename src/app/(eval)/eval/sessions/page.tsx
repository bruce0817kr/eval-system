"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { getStatusColor, getStatusLabel } from '@/lib/session'

type SessionItem = {
  session: {
    id: string
    title: string
    description: string | null
    status: 'draft' | 'open' | 'in_progress' | 'closed' | 'finalized'
  }
  role: string
  totalApplications: number
  submissionsByMe: number
  totalSubmissionsNeeded: number
}

export default function EvalSessionsPage() {
  const router = useRouter()
  const [items, setItems] = useState<SessionItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSessions = async () => {
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/eval/sessions', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? '세션을 불러오지 못했습니다')
      }

      const data = (await response.json()) as SessionItem[]
      setItems(data)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '세션을 불러오지 못했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadSessions()
  }, [])

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.session.title.localeCompare(b.session.title)),
    [items],
  )

  return (
    <div className="space-y-4 p-4 md:space-y-6 md:p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">배정받은 평가</h1>
        <p className="text-sm text-stone-600">현재 로그인한 평가위원에게 배정된 평가 회차 목록입니다.</p>
      </div>

      {error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>세션을 불러오지 못했습니다</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" onClick={() => void loadSessions()}>
              다시 시도
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={`loading-${index}`} className="animate-pulse">
              <CardHeader>
                <CardTitle className="h-5 w-2/3 rounded bg-stone-200" />
                <CardDescription className="h-4 w-5/6 rounded bg-stone-100" />
              </CardHeader>
              <CardContent>
                <div className="h-2 w-full rounded bg-stone-100" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!isLoading && !error && sortedItems.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>배정받은 평가가 없습니다</CardTitle>
            <CardDescription>
              아직 배정된 회차가 없습니다. 관리자에게 배정 여부를 확인해 주세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" onClick={() => void loadSessions()}>
              다시 확인하기
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !error && sortedItems.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {sortedItems.map((item) => {
            const total = item.totalSubmissionsNeeded || 0
            const done = item.submissionsByMe || 0
            const percent = total > 0 ? (done / total) * 100 : 0

            return (
              <Card
                key={item.session.id}
                className="cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => router.push(`/eval/sessions/${item.session.id}`)}
              >
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="line-clamp-1 text-lg">{item.session.title}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {item.session.description ?? '세션 설명이 없습니다'}
                      </CardDescription>
                    </div>
                    <Badge className={getStatusColor(item.session.status)} variant="secondary">
                      {getStatusLabel(item.session.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-stone-600">
                    <span>진행도</span>
                    <span className="font-medium text-stone-900">완료 {done}/{total}</span>
                  </div>
                  <Progress value={percent} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
