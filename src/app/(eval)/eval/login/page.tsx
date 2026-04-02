"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
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
  name: string
  phone: string
  otp: string
}

const steps = ["기본 정보", "인증번호", "접속 완료"]

export default function EvalLoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [error, setError] = useState<string | null>(null)
  const [isRequestingOtp, setIsRequestingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const form = useForm<LoginFormValues>({
    defaultValues: {
      name: "",
      phone: "",
      otp: "",
    },
  })

  useEffect(() => {
    if (step !== 3) {
      return
    }

    const timer = window.setTimeout(() => {
      router.push("/eval/sessions")
    }, 900)

    return () => window.clearTimeout(timer)
  }, [router, step])

  const submitStepOne = form.handleSubmit(async (values) => {
    setError(null)
    setIsRequestingOtp(true)

    try {
      const response = await fetch("/api/eval/auth/request-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: values.name,
          phone: values.phone,
        }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? "인증번호 요청에 실패했습니다")
      }

      setStep(2)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "인증번호 요청에 실패했습니다")
    } finally {
      setIsRequestingOtp(false)
    }
  })

  const submitStepTwo = form.handleSubmit(async (values) => {
    setError(null)
    const normalizedOtp = form.getValues("otp").replace(/\D/g, "").slice(0, 6)
    form.setValue("otp", normalizedOtp)
    setIsVerifyingOtp(true)

    try {
      const response = await fetch("/api/eval/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: values.name,
          phone: values.phone,
          code: normalizedOtp,
        }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? "인증에 실패했습니다")
      }

      setStep(3)
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "인증에 실패했습니다")
    } finally {
      setIsVerifyingOtp(false)
    }
  })

  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center p-4 md:p-6">
      <Card className="w-full max-w-md border-stone-200 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="space-y-1">
            <CardTitle>평가위원 로그인</CardTitle>
            <CardDescription>
              이름과 전화번호 인증 후 배정된 평가 목록으로 이동합니다.
            </CardDescription>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {steps.map((label, index) => {
              const stepNumber = index + 1
              const active = stepNumber === step
              const done = stepNumber < step

              return (
                <div key={label} className="space-y-2">
                  <div
                    className={`h-2 rounded-full ${
                      done || active ? "bg-primary" : "bg-stone-200"
                    }`}
                  />
                  <p className="text-xs text-stone-500">{label}</p>
                </div>
              )
            })}
          </div>
        </CardHeader>

        <Form {...form}>
          <form
            onSubmit={
              step === 1 ? submitStepOne : step === 2 ? submitStepTwo : undefined
            }
            className="space-y-0"
          >
            <CardContent className="space-y-5">
              {step === 1 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">이름</Label>
                    <Input
                      id="name"
                      placeholder="이름을 입력하세요"
                      autoComplete="name"
                      {...form.register("name", { required: true })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">전화번호</Label>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      placeholder="전화번호를 입력하세요"
                      autoComplete="tel"
                      {...form.register("phone", { required: true })}
                    />
                  </div>
                </>
              )}

              {step === 2 && (
                <div className="space-y-2">
                  <Label htmlFor="otp">인증번호</Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="6자리 인증번호를 입력하세요"
                    {...form.register("otp", { required: true })}
                  />
                  <p className="text-xs text-stone-500">
                    입력한 전화번호로 전송된 인증번호를 입력하세요.
                  </p>
                </div>
              )}

              {step === 3 && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-10 text-center">
                  <CheckCircle2 className="size-10 text-primary" />
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-stone-950">
                      인증이 완료되었습니다
                    </p>
                    <p className="text-sm text-stone-600">
                      배정받은 평가 목록으로 이동하고 있습니다.
                    </p>
                  </div>
                </div>
              )}

              {error ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
            </CardContent>

            <CardFooter className="justify-end gap-2">
              {step === 2 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                >
                  이전
                </Button>
              )}

              {step === 1 && <Button type="submit" disabled={isRequestingOtp}>{isRequestingOtp ? "전송 중..." : "인증번호 전송"}</Button>}
              {step === 2 && <Button type="submit" disabled={isVerifyingOtp}>{isVerifyingOtp ? "인증 중..." : "인증"}</Button>}
              {step === 3 && (
                <Button type="button" onClick={() => router.push("/eval/sessions")}>
                  바로 이동
                </Button>
              )}
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}
