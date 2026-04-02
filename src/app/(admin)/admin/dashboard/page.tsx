"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  FolderKanban, 
  FileCheck, 
  Clock, 
  Building2, 
  Users, 
  ChevronRight,
  FileSpreadsheet,
  FileText
} from "lucide-react"

interface DashboardStats {
  totalSessions: number
  openSessions: number
  closedSessions: number
  draftSessions: number
  totalApplications: number
  totalCommitteeMembers: number
}

interface SessionProgress {
  id: string
  title: string
  status: string
  openedAt: string | null
  closedAt: string | null
  applicationsCount: number
  committeeCount: number
  submissionsCount: number
  progress: number
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentSessions, setRecentSessions] = useState<SessionProgress[]>([])

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch')
        return res.json()
      })
      .then((data) => {
        setStats(data.stats)
        setRecentSessions(data.recentSessions)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Dashboard error:', err)
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-green-500">진행중</Badge>
      case 'closed':
        return <Badge className="bg-blue-500">완료</Badge>
      case 'draft':
        return <Badge variant="secondary">작성중</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
          <p className="text-sm text-stone-600">
            데이터를 불러오는 중 오류가 발생했습니다.
          </p>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
        <p className="text-sm text-stone-600">
          평가 현황 요약과 운영 지표입니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link href="/admin/sessions?status=open">
          <Card className="cursor-pointer hover:bg-stone-50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-stone-600">진행 중인 평가</CardDescription>
              <FolderKanban className="h-4 w-4 text-stone-400" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  {stats?.openSessions ?? 0}
                </CardTitle>
              )}
              <p className="text-xs text-stone-500 mt-1">
                총 {stats?.totalSessions ?? 0}개 회차 중
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/sessions?status=closed">
          <Card className="cursor-pointer hover:bg-stone-50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-stone-600">평가 완료</CardDescription>
              <FileCheck className="h-4 w-4 text-stone-400" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  {stats?.closedSessions ?? 0}
                </CardTitle>
              )}
              <p className="text-xs text-stone-500 mt-1">
                완료된 평가 회차
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/companies">
          <Card className="cursor-pointer hover:bg-stone-50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-stone-600">총 기업 수</CardDescription>
              <Building2 className="h-4 w-4 text-stone-400" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  {stats?.totalApplications ?? 0}
                </CardTitle>
              )}
              <p className="text-xs text-stone-500 mt-1">
                신청 완료된 기업
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/sessions?status=draft">
          <Card className="cursor-pointer hover:bg-stone-50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-stone-600">평가 예정</CardDescription>
              <Clock className="h-4 w-4 text-stone-400" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  {stats?.draftSessions ?? 0}
                </CardTitle>
              )}
              <p className="text-xs text-stone-500 mt-1">
                아직 시작 전
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/committee">
          <Card className="cursor-pointer hover:bg-stone-50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-stone-600">평가위원</CardDescription>
              <Users className="h-4 w-4 text-stone-400" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  {stats?.totalCommitteeMembers ?? 0}
                </CardTitle>
              )}
              <p className="text-xs text-stone-500 mt-1">
                활성화된 평가위원
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/sessions">
          <Card className="cursor-pointer hover:bg-stone-50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-stone-600">전체 회차</CardDescription>
              <FolderKanban className="h-4 w-4 text-stone-400" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  {stats?.totalSessions ?? 0}
                </CardTitle>
              )}
              <p className="text-xs text-stone-500 mt-1">
                전체 평가 회차
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">최근 평가 회차</CardTitle>
          <CardDescription>최근 등록된 평가 회차와 진행 상황입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : recentSessions.length === 0 ? (
            <div className="text-center py-8 text-stone-500">
              등록된 평가 회차가 없습니다.
            </div>
          ) : (
            <div className="space-y-4">
              {recentSessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/admin/sessions/${session.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-stone-50 transition-colors">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{session.title}</span>
                        {getStatusBadge(session.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-stone-500">
                        <span>기업 {session.applicationsCount}개</span>
                        <span>평가위원 {session.committeeCount}명</span>
                        {session.openedAt && (
                          <span>
                            {new Date(session.openedAt).toLocaleDateString('ko-KR')}
                          </span>
                        )}
                      </div>
                      {session.status === 'open' && (
                        <div className="flex items-center gap-2 mt-2">
                          <Progress value={session.progress} className="h-2 flex-1" />
                          <span className="text-xs text-stone-500">{session.progress}%</span>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-stone-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">빠른 작업</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/admin/sessions"
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-stone-50 transition-colors"
            >
              <FolderKanban className="h-4 w-4 text-stone-500" />
              <span className="text-sm font-medium">평가 회차 관리</span>
            </Link>
            <Link
              href="/admin/committee"
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-stone-50 transition-colors"
            >
              <Users className="h-4 w-4 text-stone-500" />
              <span className="text-sm font-medium">평가위원 관리</span>
            </Link>
            <Link
              href="/admin/companies"
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-stone-50 transition-colors"
            >
              <Building2 className="h-4 w-4 text-stone-500" />
              <span className="text-sm font-medium">기업 관리</span>
            </Link>
            <Link
              href="/admin/templates"
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-stone-50 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4 text-stone-500" />
              <span className="text-sm font-medium">평가표 템플릿</span>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">내보내기</CardTitle>
            <CardDescription>평가 결과를 파일로 내보내기</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-stone-500 mb-2">
              평가 회차 상세 페이지에서 PDF 및 Excel 내보내기가 가능합니다.
            </p>
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-stone-50">
              <FileText className="h-4 w-4 text-stone-500" />
              <span className="text-sm">평가 회차 → 결과 탭</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
