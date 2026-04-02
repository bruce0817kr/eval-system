import { createHmac } from "node:crypto"

import { type AuditAction, type ActorType } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"

export type LogAuditEventParams = {
  actorType: ActorType | "admin" | "committee_member" | "system"
  actorId: string
  action:
    | AuditAction
    | "login"
    | "logout"
    | "view"
    | "create"
    | "update"
    | "delete"
    | "submit"
    | "sign"
    | "reopen"
    | "finalize"
    | "import"
    | "export"
    | "download"
    | "aggregate"
  targetType?: string | null
  targetId?: string | null
  sessionId?: string | null
  requestId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  payloadJson?: unknown
}

function getAuditSecret(): string {
  const secret = process.env.AUTH_SECRET

  if (!secret) {
    throw new Error("AUTH_SECRET is required for audit hashing")
  }

  return secret
}

function stableStringify(value: unknown): string {
  if (value === undefined) {
    return "null"
  }

  if (value === null) {
    return "null"
  }

  if (typeof value === "string") {
    return JSON.stringify(value)
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`
  }

  if (typeof value !== "object") {
    return JSON.stringify(String(value))
  }

  const objectValue = value as Record<string, unknown>
  const keys = Object.keys(objectValue).sort()
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
    .join(",")}}`
}

function buildEventHashPayload(
  occurredAt: Date,
  previousHash: string | null,
  params: LogAuditEventParams
): string {
  return stableStringify({
    occurredAt: occurredAt.toISOString(),
    actorType: params.actorType,
    actorId: params.actorId,
    action: params.action,
    targetType: params.targetType ?? null,
    targetId: params.targetId ?? null,
    sessionId: params.sessionId ?? null,
    requestId: params.requestId ?? null,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    payloadJson: params.payloadJson ?? null,
    previousHash,
  })
}

export async function logAuditEvent(params: LogAuditEventParams): Promise<void> {
  const occurredAt = new Date()
  const previousEvent = await prisma.auditEvent.findFirst({
    orderBy: {
      occurredAt: "desc",
    },
  })
  const previousHash = previousEvent?.eventHash ?? null
  const hashPayload = buildEventHashPayload(occurredAt, previousHash, params)
  const eventHash = createHmac("sha256", getAuditSecret())
    .update(hashPayload)
    .digest("hex")

  await prisma.auditEvent.create({
    data: {
      occurredAt,
      actorType: params.actorType,
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType ?? null,
      targetId: params.targetId ?? null,
      sessionId: params.sessionId ?? null,
      requestId: params.requestId ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      payloadJson: params.payloadJson ?? undefined,
      previousHash,
      eventHash,
    },
  })
}

export const audit = {
  log: logAuditEvent,
}
