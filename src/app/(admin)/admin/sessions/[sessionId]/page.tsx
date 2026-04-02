"use client"

import { PlusIcon, RefreshCcwIcon } from "lucide-react"
import { useParams } from "next/navigation"
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react"

import {
  ApplicationTable,
  type ApplicationTableItem,
} from "@/components/admin/application-table"
import { SessionStatusButton } from "@/components/admin/session-status-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { SessionStatus } from "@/generated/prisma/client"
import { canTransition, getStatusLabel } from "@/lib/session"
import type { FormSchema } from "@/lib/types"

type SessionDetail = {
  id: string
  title: string
  description: string | null
  status: SessionStatus
  committeeSize: number
  trimRule: string
  createdAt: string
  openedAt: string | null
  closedAt: string | null
  finalizedAt: string | null
  formDefinition: {
    schemaJson: unknown
    totalScore: number
    itemsCount: number
    snapshotAt: string
  } | null
  applications: ApplicationTableItem[]
  committeeMembers: {
    id: string
    role: string
    committeeMember: {
      id: string
      name: string
      phone: string
      organization: string | null
      position: string | null
      field: string | null
    }
  }[]
}

function getStatusBadgeVariant(status: SessionStatus) {
  if (status === "draft") {
    return "secondary" as const
  }

  if (status === "closed") {
    return "outline" as const
  }

  return "default" as const
}

export default function AdminSessionDetailPage() {
  const params = useParams<{ sessionId: string }>()
  const sessionId = params.sessionId

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [companyId, setCompanyId] = useState("")
  const [evaluationOrder, setEvaluationOrder] = useState("")
  const [applicationError, setApplicationError] = useState<string | null>(null)
  const [applicationPending, setApplicationPending] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const fetchSession = useCallback(async () => {
    if (!sessionId) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}`, {
        cache: "no-store",
      })

      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        setError(result.error ?? "회차 정보를 불러오지 못했습니다")
        return
      }

      const result = (await response.json()) as SessionDetail
      setSession(result)
    } catch {
      setError("회차 정보를 불러오는 중 네트워크 오류가 발생했습니다")
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void fetchSession()
  }, [fetchSession])

  const transitionTargets = useMemo(() => {
    if (!session) {
      return []
    }

    const candidates = [
      "open",
      "in_progress",
      "closed",
      "finalized",
      "reopened",
    ] as const

    return candidates.filter((status) => canTransition(session.status, status))
  }, [session])

  const parsedSchema = useMemo(() => {
    if (!session?.formDefinition?.schemaJson) {
      return null
    }

    const schema = session.formDefinition.schemaJson
    if (typeof schema !== "object" || schema === null || !("sections" in schema)) {
      return null
    }

    return schema as FormSchema
  }, [session?.formDefinition?.schemaJson])

  async function handleAddApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!companyId.trim()) {
      setApplicationError("기업 ID를 입력해주세요")
      return
    }

    setApplicationPending(true)
    setApplicationError(null)

    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}/applications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId: companyId.trim(),
          evaluationOrder: evaluationOrder ? Number(evaluationOrder) : undefined,
        }),
      })

      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        setApplicationError(result.error ?? "기업 추가에 실패했습니다")
        return
      }

      setCompanyId("")
      setEvaluationOrder("")
      await fetchSession()
    } catch {
      setApplicationError("기업 추가 중 네트워크 오류가 발생했습니다")
    } finally {
      setApplicationPending(false)
    }
  }

  async function handleRemoveApplication(applicationId: string) {
    setRemovingId(applicationId)
    setApplicationError(null)

    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}/applications`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ applicationId }),
      })

      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        setApplicationError(result.error ?? "기업 제거에 실패했습니다")
        return
      }

      await fetchSession()
    } catch {
      setApplicationError("기업 제거 중 네트워크 오류가 발생했습니다")
    } finally {
      setRemovingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (!session || error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>회차 정보를 불러오지 못했습니다</CardTitle>
          <CardDescription>{error ?? "잠시 후 다시 시도해주세요."}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={() => void fetchSession()}>
            <RefreshCcwIcon className="size-4" />
            다시 시도
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{session.title}</h1>
          <Badge variant={getStatusBadgeVariant(session.status)}>
            {getStatusLabel(session.status)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {session.description || "등록된 회차 설명이 없습니다."}
        </p>
      </div>

      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList variant="line">
          <TabsTrigger value="basic">기본정보</TabsTrigger>
          <TabsTrigger value="applications">기업관리</TabsTrigger>
          <TabsTrigger value="committee">평가위원</TabsTrigger>
          <TabsTrigger value="form">평가표</TabsTrigger>
          <TabsTrigger value="results">결과</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <Card>
            <CardHeader>
              <CardTitle>회차 기본정보</CardTitle>
              <CardDescription>상태 전이와 운영 파라미터를 확인하세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">위원 수</p>
                  <p className="text-sm font-medium">{session.committeeSize}명</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">절사 규칙</p>
                  <p className="text-sm font-medium">{session.trimRule}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">상태 변경</p>
                <div className="flex flex-wrap gap-2">
                  {transitionTargets.length > 0 ? (
                    transitionTargets.map((target) => (
                      <SessionStatusButton
                        key={target}
                        sessionId={session.id}
                        targetStatus={target}
                        currentStatus={session.status}
                        onChanged={fetchSession}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">가능한 상태 변경이 없습니다.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>기업 추가</CardTitle>
              <CardDescription>기업 ID로 회차에 기업을 배정합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-[1fr_160px_auto]" onSubmit={handleAddApplication}>
                <Input
                  placeholder="기업 ID"
                  value={companyId}
                  onChange={(event) => setCompanyId(event.target.value)}
                  disabled={applicationPending}
                />
                <Input
                  type="number"
                  min={1}
                  placeholder="평가 순서(선택)"
                  value={evaluationOrder}
                  onChange={(event) => setEvaluationOrder(event.target.value)}
                  disabled={applicationPending}
                />
                <Button type="submit" disabled={applicationPending}>
                  <PlusIcon className="size-4" />
                  기업 추가
                </Button>
              </form>
              {applicationError ? (
                <p className="mt-2 text-sm text-destructive">{applicationError}</p>
              ) : null}
            </CardContent>
          </Card>

          <ApplicationTable
            applications={session.applications}
            onRemove={handleRemoveApplication}
            removingId={removingId}
          />
        </TabsContent>

        <TabsContent value="committee">
          <Card>
            <CardHeader>
              <CardTitle>배정된 평가위원</CardTitle>
              <CardDescription>현재 회차에 배정된 위원 목록입니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>연락처</TableHead>
                      <TableHead>소속</TableHead>
                      <TableHead>직책</TableHead>
                      <TableHead>역할</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {session.committeeMembers.length > 0 ? (
                      session.committeeMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>{member.committeeMember.name}</TableCell>
                          <TableCell>{member.committeeMember.phone}</TableCell>
                          <TableCell>{member.committeeMember.organization || "-"}</TableCell>
                          <TableCell>{member.committeeMember.position || "-"}</TableCell>
                          <TableCell>{member.role}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          배정된 평가위원이 없습니다.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="form">
          <Card>
            <CardHeader>
              <CardTitle>평가표 스냅샷</CardTitle>
              <CardDescription>
                회차에 고정된 평가표 정의를 확인합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {session.formDefinition ? (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">총점</p>
                      <p className="text-sm font-medium">{session.formDefinition.totalScore}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">문항 수</p>
                      <p className="text-sm font-medium">{session.formDefinition.itemsCount}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">스냅샷 시각</p>
                      <p className="text-sm font-medium">
                        {new Date(session.formDefinition.snapshotAt).toLocaleString("ko-KR")}
                      </p>
                    </div>
                  </div>

                  {parsedSchema?.sections?.length ? (
                    <div className="space-y-3">
                      {parsedSchema.sections.map((section) => (
                        <div key={section.id} className="rounded-md border p-3">
                          <p className="font-medium">{section.title}</p>
                          <p className="text-xs text-muted-foreground">가중치 {section.weight}</p>
                          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                            {section.items.map((item) => (
                              <li key={item.id}>• {item.label}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      현재 저장된 평가표 스키마를 미리보기할 수 없습니다.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">설정된 평가표가 없습니다.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>결과</CardTitle>
              <CardDescription>결과 관리 UI는 Phase 4에서 제공됩니다.</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
