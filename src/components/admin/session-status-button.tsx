"use client"

import { Loader2Icon } from "lucide-react"
import { useMemo, useState } from "react"

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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { SessionStatus } from "@/generated/prisma/client"
import { getStatusLabel } from "@/lib/session"

type TransitionTarget = SessionStatus | "reopened"

type SessionStatusButtonProps = {
  sessionId: string
  targetStatus: TransitionTarget
  currentStatus: SessionStatus
  onChanged?: () => void
}

function getConfirmCopy(targetStatus: TransitionTarget) {
  if (targetStatus === "open") {
    return {
      button: "오픈",
      title: "회차를 오픈하시겠습니까?",
      description: "오픈 이후에는 참여자가 평가 준비 상태로 전환됩니다.",
    }
  }

  if (targetStatus === "in_progress") {
    return {
      button: "평가 시작",
      title: "평가를 시작하시겠습니까?",
      description: "평가 시작 후에는 위원의 평가 진행 상태가 기록됩니다.",
    }
  }

  if (targetStatus === "closed") {
    return {
      button: "마감",
      title: "회차를 마감하시겠습니까?",
      description: "마감 후에는 신규 제출이 제한됩니다.",
    }
  }

  if (targetStatus === "finalized") {
    return {
      button: "최종 확정",
      title: "결과를 최종 확정하시겠습니까?",
      description: "집계가 실행되고 순위가 최종 스냅샷으로 저장됩니다.",
    }
  }

  return {
    button: "재개방",
    title: "회차를 재개방하시겠습니까?",
    description: "재개방 시 기존 제출본이 무효화되고 회차가 다시 진행 상태가 됩니다.",
  }
}

export function SessionStatusButton({
  sessionId,
  targetStatus,
  currentStatus,
  onChanged,
}: SessionStatusButtonProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  const copy = useMemo(() => getConfirmCopy(targetStatus), [targetStatus])

  async function handleConfirm() {
    setPending(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: targetStatus,
          reason: reason.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        setError(result.error ?? "상태 변경에 실패했습니다")
        return
      }

      setOpen(false)
      setReason("")
      onChanged?.()
    } catch {
      setError("상태 변경 중 네트워크 오류가 발생했습니다")
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        {copy.button}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>
            현재 상태: {getStatusLabel(currentStatus)} → 변경 상태: {getStatusLabel(targetStatus)}
            <br />
            {copy.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {targetStatus === "reopened" ? (
          <div className="grid gap-2 px-1">
            <Label htmlFor={`reopen-reason-${sessionId}`}>재개방 사유 (선택)</Label>
            <Input
              id={`reopen-reason-${sessionId}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="예: 추가 검토를 위한 재개방"
              disabled={pending}
            />
          </div>
        ) : null}
        {error ? <p className="px-1 text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>취소</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={handleConfirm}>
            {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {copy.button}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
