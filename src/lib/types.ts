import type {
  AdminUser,
  AggregationRun,
  Application,
  AuditEvent,
  Company,
  EvaluationSession,
  ImportBatch,
  ResultSnapshot,
  SessionCommitteeAssignment,
  SessionFormDefinition,
} from "@/generated/prisma/client"

export type ScoreOption = {
  score: number
  label: string
}

export type RadioScoreFormItem = {
  id: string
  type: "radio_score"
  label: string
  weight: number
  required: boolean
  options: ScoreOption[]
}

export type TextFormItem = {
  id: string
  type: "text"
  label: string
  required: boolean
  placeholder?: string
}

export type FormItem = RadioScoreFormItem | TextFormItem

export type FormSection = {
  id: string
  title: string
  weight: number
  items: FormItem[]
}

export type FormSchema = {
  sections: FormSection[]
}

export type EvaluationAnswerValue = string | number | null

export type EvaluationAnswers = Record<string, EvaluationAnswerValue>

export type SessionWithRelations = EvaluationSession & {
  createdBy?: AdminUser | null
  formDefinition?: SessionFormDefinition | null
  applications: Application[]
  committeeMembers: SessionCommitteeAssignment[]
  resultSnapshots: ResultSnapshot[]
  importBatches: ImportBatch[]
  aggregationRuns: AggregationRun[]
  auditEvents: AuditEvent[]
}

export type ApplicationWithCompany = Application & {
  company: Company
}
