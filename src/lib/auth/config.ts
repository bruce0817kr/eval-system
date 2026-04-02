import NextAuth, { type NextAuthConfig } from "next-auth"
import type { NextRequest } from "next/server"
import CredentialsProvider from "next-auth/providers/credentials"
import { z } from "zod"

import { AdminRole } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"
import { verifyOtp } from "@/lib/auth/otp"
import { verifyPassword } from "@/lib/auth/password"

export type AuthRole = AdminRole | "committee_member"

type AuthUser = {
  id: string
  role: AuthRole
}

type AuthToken = {
  id?: string
  role?: AuthRole
}

const adminCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const committeeCredentialsSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  otp: z.string().regex(/^\d{6}$/),
})

function resolveSignInPage(request?: NextRequest): string {
  if (!request) {
    return "/admin/login"
  }

  const provider = request.nextUrl.searchParams.get("provider")
  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl")
  const redirectTo = request.nextUrl.searchParams.get("redirectTo")
  const target = `${callbackUrl ?? ""} ${redirectTo ?? ""}`

  if (provider === "committee" || target.includes("/eval")) {
    return "/eval/login"
  }

  return "/admin/login"
}

const baseAuthConfig = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      id: "admin",
      name: "Admin",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsedCredentials = adminCredentialsSchema.safeParse(credentials)

        if (!parsedCredentials.success) {
          return null
        }

        const admin = await prisma.adminUser.findUnique({
          where: { email: parsedCredentials.data.email },
        })

        if (!admin) {
          return null
        }

        const isValidPassword = await verifyPassword(
          parsedCredentials.data.password,
          admin.passwordHash
        )

        if (!isValidPassword) {
          return null
        }

        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        }
      },
    }),
    CredentialsProvider({
      id: "committee",
      name: "Committee",
      credentials: {
        name: { label: "Name", type: "text" },
        phone: { label: "Phone", type: "tel" },
        otp: { label: "OTP", type: "text" },
      },
      async authorize(credentials) {
        const parsedCredentials = committeeCredentialsSchema.safeParse(credentials)

        if (!parsedCredentials.success) {
          return null
        }

        const isValidOtp = await verifyOtp(
          parsedCredentials.data.phone,
          parsedCredentials.data.otp
        )

        if (!isValidOtp) {
          return null
        }

        const committeeMember = await prisma.committeeMember.findFirst({
          where: {
            name: parsedCredentials.data.name,
            phone: parsedCredentials.data.phone,
            isActive: true,
          },
        })

        if (!committeeMember) {
          return null
        }

        return {
          id: committeeMember.id,
          name: committeeMember.name,
          email: null,
          role: "committee_member" as const,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const nextToken = token as typeof token & AuthToken
      const nextUser = user as (typeof user & AuthUser) | undefined

      if (nextUser) {
        nextToken.id = nextUser.id
        nextToken.role = nextUser.role
      }

      return nextToken
    },
    async session({ session, token }) {
      const nextToken = token as typeof token & AuthToken

      if (session.user && nextToken.id && nextToken.role) {
        const nextUser = session.user as typeof session.user & AuthUser
        nextUser.id = nextToken.id
        nextUser.role = nextToken.role
      }

      return session
    },
  },
} satisfies Omit<NextAuthConfig, "pages">

export const authConfig = (request?: NextRequest): NextAuthConfig => ({
  ...baseAuthConfig,
  pages: {
    signIn: resolveSignInPage(request),
  },
})

export const {
  handlers: { GET, POST },
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth(authConfig)
