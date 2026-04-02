import { SessionStatus } from "@/generated/prisma/client"

export type EvaluationSessionStatus = `${SessionStatus}` | "reopened"

const transitionMap: Record<EvaluationSessionStatus, readonly EvaluationSessionStatus[]> = {
  draft: ["open"],
  open: ["in_progress"],
  in_progress: ["closed"],
  closed: ["finalized", "reopened"],
  finalized: [],
  reopened: ["in_progress"],
}

const statusLabelMap: Record<EvaluationSessionStatus, string> = {
  draft: "초안",
  open: "오픈",
  in_progress: "평가 진행중",
  closed: "마감",
  finalized: "최종 확정",
  reopened: "재개방",
}

const statusColorMap: Record<EvaluationSessionStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  closed: "bg-zinc-100 text-zinc-700",
  finalized: "bg-emerald-100 text-emerald-700",
  reopened: "bg-purple-100 text-purple-700",
}

export function canTransition(
  currentStatus: EvaluationSessionStatus,
  targetStatus: EvaluationSessionStatus
): boolean {
  return transitionMap[currentStatus].includes(targetStatus)
}

export function getStatusLabel(status: EvaluationSessionStatus): string {
  return statusLabelMap[status]
}

export function getStatusColor(status: EvaluationSessionStatus): string {
  return statusColorMap[status]
}
