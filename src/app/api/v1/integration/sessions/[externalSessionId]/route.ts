import { NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import {
  integrationError,
  integrationUnauthorized,
  verifyIntegrationRequest,
} from '@/lib/integration/auth'

const sessionBodySchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  committeeSize: z.number().int().min(1).max(50).optional(),
  trimRule: z.string().trim().min(1).optional(),
})

type RouteContext = {
  params: Promise<{ externalSessionId: string }>
}

export async function PUT(request: Request, context: RouteContext) {
  if (!verifyIntegrationRequest(request)) {
    return integrationUnauthorized()
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return integrationError('INVALID_JSON', 'Request body must be valid JSON', 400)
  }

  const parsed = sessionBodySchema.safeParse(body)
  if (!parsed.success) {
    return integrationError('VALIDATION_ERROR', 'Session payload is invalid', 400, parsed.error.flatten())
  }

  const { externalSessionId } = await context.params
  const session = await prisma.evaluationSession.upsert({
    where: { id: externalSessionId },
    create: {
      id: externalSessionId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      committeeSize: parsed.data.committeeSize ?? 5,
      trimRule: parsed.data.trimRule ?? 'exclude_min_max',
      status: 'draft',
    },
    update: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      committeeSize: parsed.data.committeeSize,
      trimRule: parsed.data.trimRule,
    },
  })

  return NextResponse.json({
    externalSessionId: session.id,
    title: session.title,
    description: session.description,
    status: session.status,
    committeeSize: session.committeeSize,
    trimRule: session.trimRule,
    updatedAt: new Date().toISOString(),
  })
}
