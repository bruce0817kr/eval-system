"use client"

import { ClipboardListIcon, PencilIcon, Plus, RefreshCcwIcon, SaveIcon, Trash2, XIcon } from "lucide-react"
import { useParams } from "next/navigation"
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react"

import { ApplicationTable } from "@/components/admin/application-table"
import { CommitteeAssignDialog } from "@/components/admin/committee-assign-dialog"
import { ResultsTabContent } from "@/components/admin/results-tab-content"
import { SessionStatusButton } from "@/components/admin/session-status-button"
import { SubmissionDialog } from "@/components/admin/submission-dialog"
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
} from "@/components/ui/alert-dialog"
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
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
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
  applicationsCount: number
  committeeMembers: {
    id: string
    role: string
    submittedCount: number
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

  // committee 탭
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [committeeError, setCommitteeError] = useState<string | null>(null)
  const [submissionDialog, setSubmissionDialog] = useState<{ memberId: string; memberName: string } | null>(null)

  // 기본정보 편집 상태
  const [editingBasic, setEditingBasic] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editCommitteeSize, setEditCommitteeSize] = useState("")
  const [editTrimRule, setEditTrimRule] = useState("")
  const [basicSavePending, setBasicSavePending] = useState(false)
  const [basicSaveError, setBasicSaveError] = useState<string | null>(null)

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

  function startEditBasic() {
    if (!session) return
    setEditTitle(session.title)
    setEditDescription(session.description ?? "")
    setEditCommitteeSize(String(session.committeeSize))
    setEditTrimRule(session.trimRule)
    setBasicSaveError(null)
    setEditingBasic(true)
  }

  async function handleSaveBasic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session) return

    const size = Number(editCommitteeSize)
    if (!editTitle.trim()) {
      setBasicSaveError("회차명을 입력해주세요")
      return
    }
    if (!Number.isInteger(size) || size < 1 || size > 50) {
      setBasicSaveError("위원 수는 1~50 사이 정수여야 합니다")
      return
    }

    setBasicSavePending(true)
    setBasicSaveError(null)

    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          committeeSize: size,
          trimRule: editTrimRule.trim(),
        }),
      })

      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        setBasicSaveError(result.error ?? "저장에 실패했습니다")
        return
      }

      setEditingBasic(false)
      await fetchSession()
    } catch {
      setBasicSaveError("저장 중 네트워크 오류가 발생했습니다")
    } finally {
      setBasicSavePending(false)
    }
  }

  const handleUnassign = async (assignmentId: string) => {
    setCommitteeError(null)
    try {
      const response = await fetch(
        `/api/admin/sessions/${sessionId}/committee/${assignmentId}`,
        { method: "DELETE" },
      )
      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        setCommitteeError(result.error ?? "위원 해제에 실패했습니다")
        return
      }
      await fetchSession()
    } catch {
      setCommitteeError("위원 해제 중 오류가 발생했습니다")
    }
  }

  const handleRoleChange = async (assignmentId: string, newRole: "chair" | "member") => {
    setCommitteeError(null)
    try {
      const response = await fetch(
        `/api/admin/sessions/${sessionId}/committee/${assignmentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        },
      )
      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        setCommitteeError(result.error ?? "역할 변경에 실패했습니다")
        return
      }
      await fetchSession()
    } catch {
      setCommitteeError("역할 변경 중 오류가 발생했습니다")
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

        <TabsContent value="basic" className="space-y-4">
          {/* 기본정보 카드 */}
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>회차 기본정보</CardTitle>
                <CardDescription>
                  {session.status === "draft"
                    ? "초안 상태에서만 수정할 수 있습니다."
                    : "오픈 이후에는 수정이 제한됩니다."}
                </CardDescription>
              </div>
              {session.status === "draft" && !editingBasic && (
                <Button type="button" variant="outline" size="sm" onClick={startEditBasic}>
                  <PencilIcon className="size-4" />
                  편집
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {editingBasic ? (
                <form className="space-y-4" onSubmit={handleSaveBasic}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="edit-title">회차명</Label>
                      <Input
                        id="edit-title"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        disabled={basicSavePending}
                        placeholder="예: 2024년 1차 지원사업 선정평가"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="edit-desc">설명 (선택)</Label>
                      <Textarea
                        id="edit-desc"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        disabled={basicSavePending}
                        rows={3}
                        placeholder="회차에 대한 설명을 입력하세요"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-size">평가위원 수</Label>
                      <Input
                        id="edit-size"
                        type="number"
                        min={1}
                        max={50}
                        value={editCommitteeSize}
                        onChange={(e) => setEditCommitteeSize(e.target.value)}
                        disabled={basicSavePending}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-trim">절사 규칙</Label>
                      <Input
                        id="edit-trim"
                        value={editTrimRule}
                        onChange={(e) => setEditTrimRule(e.target.value)}
                        disabled={basicSavePending}
                        placeholder="예: exclude_min_max"
                      />
                    </div>
                  </div>
                  {basicSaveError && (
                    <p className="text-sm text-destructive">{basicSaveError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={basicSavePending}>
                      <SaveIcon className="size-4" />
                      저장
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={basicSavePending}
                      onClick={() => setEditingBasic(false)}
                    >
                      <XIcon className="size-4" />
                      취소
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border p-3 md:col-span-2">
                    <p className="text-xs text-muted-foreground">회차명</p>
                    <p className="text-sm font-medium">{session.title}</p>
                  </div>
                  {session.description && (
                    <div className="rounded-md border p-3 md:col-span-2">
                      <p className="text-xs text-muted-foreground">설명</p>
                      <p className="text-sm">{session.description}</p>
                    </div>
                  )}
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">위원 수</p>
                    <p className="text-sm font-medium">{session.committeeSize}명</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">절사 규칙</p>
                    <p className="text-sm font-medium">{session.trimRule}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 상태 변경 카드 */}
          <Card>
            <CardHeader>
              <CardTitle>상태 변경</CardTitle>
              <CardDescription>회차 진행 단계를 전환합니다.</CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications">
          <ApplicationTable sessionId={sessionId} />
        </TabsContent>

        <TabsContent value="committee">
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>배정된 평가위원</CardTitle>
                <CardDescription>
                  현재 회차에 배정된 위원 목록입니다. ({session.committeeMembers.length} / {session.committeeSize}명)
                </CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsAssignDialogOpen(true)}
              >
                <Plus className="size-4" />
                위원 배정
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {committeeError && (
                <p className="text-sm text-destructive">{committeeError}</p>
              )}
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>연락처</TableHead>
                      <TableHead>소속</TableHead>
                      <TableHead>역할</TableHead>
                      <TableHead>진행현황</TableHead>
                      <TableHead className="text-right">액션</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {session.committeeMembers.length > 0 ? (
                      session.committeeMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.committeeMember.name}</TableCell>
                          <TableCell>{member.committeeMember.phone}</TableCell>
                          <TableCell>{member.committeeMember.organization || "-"}</TableCell>
                          <TableCell>
                            {member.role === "chair" ? (
                              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">위원장</Badge>
                            ) : (
                              <Badge variant="secondary">위원</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {member.submittedCount} / {session.applicationsCount} 제출
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setSubmissionDialog({
                                    memberId: member.committeeMember.id,
                                    memberName: member.committeeMember.name,
                                  })
                                }
                              >
                                <ClipboardListIcon className="size-4" />
                                제출 현황
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  void handleRoleChange(
                                    member.id,
                                    member.role === "chair" ? "member" : "chair",
                                  )
                                }
                              >
                                {member.role === "chair" ? "위원으로" : "위원장으로"}
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger
                                  render={
                                    <Button type="button" size="sm" variant="destructive" />
                                  }
                                >
                                  <Trash2 className="size-4" />
                                  해제
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>위원 배정을 해제할까요?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {member.committeeMember.name} 위원의 배정을 해제합니다.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>취소</AlertDialogCancel>
                                    <AlertDialogAction
                                      variant="destructive"
                                      onClick={() => void handleUnassign(member.id)}
                                    >
                                      해제
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
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
          <ResultsTabContent sessionId={sessionId} sessionStatus={session.status} />
        </TabsContent>
      </Tabs>

      <CommitteeAssignDialog
        open={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        sessionId={sessionId}
        alreadyAssignedIds={session.committeeMembers.map((m) => m.committeeMember.id)}
        onAssigned={() => void fetchSession()}
      />

      <SubmissionDialog
        sessionId={sessionId}
        memberId={submissionDialog?.memberId ?? ""}
        memberName={submissionDialog?.memberName ?? ""}
        open={submissionDialog !== null}
        onOpenChange={(open) => { if (!open) setSubmissionDialog(null) }}
      />
    </div>
  )
}
