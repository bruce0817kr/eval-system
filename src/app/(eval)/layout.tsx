"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'

type EvaluatorMe = {
  id: string
  name: string
  phone: string
  organization: string | null
  position: string | null
}

export default function EvalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [me, setMe] = useState<EvaluatorMe | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    let mounted = true

    const loadMe = async () => {
      try {
        const response = await fetch('/api/eval/me', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
        })

        if (!response.ok) {
          if (response.status === 401) {
            router.replace('/eval/login')
          }
          return
        }

        const data = (await response.json()) as EvaluatorMe

        if (mounted) {
          setMe(data)
        }
      } catch {
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void loadMe()

    return () => {
      mounted = false
    }
  }, [router])

  const handleLogout = async () => {
    if (isLoggingOut) {
      return
    }

    setIsLoggingOut(true)

    try {
      await fetch('/api/eval/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
    } finally {
      router.replace('/eval/login')
      router.refresh()
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
          <div>
            <p className="text-sm font-semibold text-stone-950">선정평가 시스템</p>
            <p className="text-xs text-stone-500">평가 포털</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-stone-900">
                {isLoading ? '평가위원 정보 불러오는 중...' : me?.name ?? '평가위원'}
              </p>
              <p className="text-xs text-stone-500">
                {me?.organization ? `${me.organization}` : '위원 계정'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  )
}
