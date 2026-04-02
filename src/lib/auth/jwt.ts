import { jwtVerify } from 'jose'
import { z } from 'zod'

const adminSessionSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['admin', 'operator', 'auditor']),
  type: z.literal('admin'),
})

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET

  if (!secret) {
    throw new Error('AUTH_SECRET is not configured')
  }

  return new TextEncoder().encode(secret)
}

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null
  }

  const target = `${name}=`
  const cookies = cookieHeader.split(';')

  for (const cookie of cookies) {
    const trimmed = cookie.trim()

    if (trimmed.startsWith(target)) {
      return decodeURIComponent(trimmed.slice(target.length))
    }
  }

  return null
}

export type AdminSession = {
  id: string
  email: string
  name: string
  role: 'admin' | 'operator' | 'auditor'
}

type RoleLevel = 'admin' | 'operator' | 'auditor'

const roleHierarchy: Record<RoleLevel, number> = {
  admin: 3,
  operator: 2,
  auditor: 1,
}

export function hasMinimumRole(
  userRole: RoleLevel,
  minimumRole: RoleLevel,
): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[minimumRole]
}

export function requireRole(session: AdminSession | null, minimumRole: RoleLevel): boolean {
  if (!session) return false
  return hasMinimumRole(session.role, minimumRole)
}

export async function getAdminSession(
  request: Request,
): Promise<AdminSession | null> {
  const token = getCookieValue(request.headers.get('cookie'), 'admin_session')

  if (!token) {
    return null
  }

  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), {
      algorithms: ['HS256'],
    })

    const parsed = adminSessionSchema.safeParse(payload)

    if (!parsed.success) {
      return null
    }

    return {
      id: parsed.data.sub,
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
    }
  } catch {
    return null
  }
}

const sessionPayloadSchema = z.object({
  sub: z.string().min(1),
})

export async function verifySession(cookieName: string, request: Request) {
  const token = getCookieValue(request.headers.get('cookie'), cookieName)

  if (!token) {
    return null
  }

  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), {
      algorithms: ['HS256'],
    })

    const parsed = sessionPayloadSchema.safeParse(payload)

    if (!parsed.success) {
      return null
    }

    return payload
  } catch {
    return null
  }
}
