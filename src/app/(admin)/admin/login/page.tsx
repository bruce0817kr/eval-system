"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Shield } from "lucide-react"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Form } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type LoginFormValues = {
  email: string
  password: string
}

export default function AdminLoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const form = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? "로그인에 실패했습니다")
      }

      router.push("/admin/dashboard")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다")
    } finally {
      setIsLoading(false)
    }
  })

  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center p-4 md:p-6">
      <Card className="w-full max-w-md border-stone-200 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Shield className="size-5" />
            </div>
            <div className="space-y-1">
              <CardTitle>관리자 로그인</CardTitle>
              <CardDescription>
                관리자 계정으로 접속하세요.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-0">
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  autoComplete="email"
                  {...form.register("email", { required: true })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="비밀번호를 입력하세요"
                  autoComplete="current-password"
                  {...form.register("password", { required: true })}
                />
              </div>

              {error ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
            </CardContent>

            <CardFooter className="justify-end">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "로그인 중..." : "로그인"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}
