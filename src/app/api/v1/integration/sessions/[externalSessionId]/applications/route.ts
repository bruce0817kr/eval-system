import { NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import {
  integrationError,
  integrationUnauthorized,
  verifyIntegrationRequest,
} from '@/lib/integration/auth'

const companySchema = z.object({
  externalCompanyId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  ceoName: z.string().trim().optional().nullable(),
  businessNumber: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  industry: z.string().trim().optional().nullable(),
})

const applicationSchema = z.object({
  externalApplicationId: z.string().trim().min(1),
  company: companySchema,
  evaluationOrder: z.number().int().min(0).optional(),
  notes: z.string().trim().optional().nullable(),
})

const applicationsBodySchema = z.object({
  applications: z.array(applicationSchema).min(1).max(200),
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

  const parsed = applicationsBodySchema.safeParse(body)
  if (!parsed.success) {
    return integrationError('VALIDATION_ERROR', 'Applications payload is invalid', 400, parsed.error.flatten())
  }

  const { externalSessionId } = await context.params
  const session = await prisma.evaluationSession.findUnique({
    where: { id: externalSessionId },
    select: { id: true },
  })

  if (!session) {
    return integrationError('SESSION_NOT_FOUND', 'Integration session not found', 404)
  }

  const applications = await prisma.$transaction(async (tx) => {
    const results = []

    for (const item of parsed.data.applications) {
      const company = await tx.company.upsert({
        where: { id: item.company.externalCompanyId },
        create: {
          id: item.company.externalCompanyId,
          name: item.company.name,
          ceoName: item.company.ceoName ?? null,
          businessNumber: item.company.businessNumber ?? null,
          address: item.company.address ?? null,
          phone: item.company.phone ?? null,
          email: item.company.email ?? null,
          industry: item.company.industry ?? null,
        },
        update: {
          name: item.company.name,
          ceoName: item.company.ceoName ?? null,
          businessNumber: item.company.businessNumber ?? null,
          address: item.company.address ?? null,
          phone: item.company.phone ?? null,
          email: item.company.email ?? null,
          industry: item.company.industry ?? null,
        },
      })

      const application = await tx.application.upsert({
        where: { id: item.externalApplicationId },
        create: {
          id: item.externalApplicationId,
          sessionId: externalSessionId,
          companyId: company.id,
          evaluationOrder: item.evaluationOrder ?? 0,
          notes: item.notes ?? null,
          status: 'registered',
        },
        update: {
          evaluationOrder: item.evaluationOrder,
          notes: item.notes ?? null,
        },
        include: { company: true },
      })

      results.push({
        externalApplicationId: application.id,
        externalCompanyId: application.company.id,
        companyName: application.company.name,
        evaluationOrder: application.evaluationOrder,
        status: application.status,
      })
    }

    return results
  })

  return NextResponse.json({
    externalSessionId,
    upsertedCount: applications.length,
    applications,
  })
}
