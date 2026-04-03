"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import SignaturePad from 'signature_pad'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { type FormSchema } from '@/lib/form-template-schema'

type SignatureSubmitDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  applicationId: string
  schema: FormSchema
  answers: Record<string, unknown>
  evaluatorName: string
  evaluatorPhone: string
  onSigned: () => void
}

type RequestOtpResponse = {
  message: string
  code: string
  targetNumber: string
  instructions: string
}

function getMissingRequired(schema: FormSchema, answers: Record<string, unknown>) {
  const missing: string[] = []

  for (const section of schema.sections) {
    for (const item of section.items) {
      if (item.type === 'heading' || !item.required) {
        continue
      }

      if (item.type === 'text') {
        const answer = answers[item.id]
        if (typeof answer !== 'string' || answer.trim().length === 0) {
          missing.push(item.label)
        }
        continue
      }

      const answer = answers[item.id]
      if (typeof answer !== 'number') {
        missing.push(item.label)
      }
    }
  }

  return missing
}

export function SignatureSubmitDialog({
  open,
  onOpenChange,
  sessionId,
  applicationId,
  schema,
  answers,
  evaluatorName,
  evaluatorPhone,
  onSigned,
}: SignatureSubmitDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [error, setError] = useState<string | null>(null)
  const [otpCode, setOtpCode] = useState('')
  const [isOtpSending, setIsOtpSending] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpData, setOtpData] = useState<RequestOtpResponse | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const signatureRef = useRef<SignaturePad | null>(null)

  useEffect(() => {
    if (!open || !canvasRef.current) {
      return
    }

    const signaturePad = new SignaturePad(canvasRef.current, {
      minWidth: 0.8,
      maxWidth: 2,
    })
    signatureRef.current = signaturePad

    return () => {
      signatureRef.current = null
    }
  }, [open, step])

  useEffect(() => {
    if (!open) {
      setStep(1)
      setError(null)
      setOtpCode('')
      setOtpSent(false)
      setOtpData(null)
    }
  }, [open])

  const requiredMissing = useMemo(() => getMissingRequired(schema, answers), [answers, schema])
  const scoreSummary = useMemo(() => {
    let totalWeight = 0
    let totalScore = 0

    for (const section of schema.sections) {
      for (const item of section.items) {
        if (item.type !== 'radio_score') {
          continue
        }

        const maxScore = Math.max(...item.options.map((option) => option.score))
        const answer = answers[item.id]
        const selected = typeof answer === 'number' ? answer : 0
        const weighted = maxScore > 0 ? (selected / maxScore) * item.weight : 0

        totalWeight += item.weight
        totalScore += weighted
      }
    }

    return {
      totalScore,
      totalWeight,
    }
  }, [answers, schema.sections])

  const requestOtp = async () => {
    setError(null)
    setIsOtpSending(true)

    try {
      const response = await fetch('/api/eval/auth/request-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: evaluatorName,
          phone: evaluatorPhone,
        }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? 'OTP 요청에 실패했습니다')
      }

      const data = (await response.json()) as RequestOtpResponse
      setOtpData(data)
      setOtpSent(true)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'OTP 요청에 실패했습니다')
    } finally {
      setIsOtpSending(false)
    }
  }

  const submitAndSign = async () => {
    setError(null)

    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      setError('서명을 입력해 주세요')
      return
    }

    setIsSubmitting(true)

    try {
      const submitResponse = await fetch(`/api/eval/sessions/${sessionId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          applicationId,
          answersJson: answers,
        }),
      })

      if (!submitResponse.ok) {
        const data = (await submitResponse.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? '최종 제출에 실패했습니다')
      }

      const submitData = (await submitResponse.json()) as { submission: { id: string } }
      const dataUrl = signatureRef.current.toDataURL('image/png')

      const signResponse = await fetch(`/api/eval/sessions/${sessionId}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          submissionId: submitData.submission.id,
          signatureImageDataUrl: dataUrl,
          otpCode,
        }),
      })

      if (!signResponse.ok) {
        const data = (await signResponse.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? '서명 처리에 실패했습니다')
      }

      onSigned()
      onOpenChange(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '제출 처리에 실패했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>최종 제출 및 서명</DialogTitle>
          <DialogDescription>평가 내용을 제출하고 서명 및 OTP 인증을 완료하세요.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <Badge variant={step === 1 ? 'default' : 'secondary'}>1. 제출 내용 확인</Badge>
            <Badge variant={step === 2 ? 'default' : 'secondary'}>2. 서명</Badge>
            <Badge variant={step === 3 ? 'default' : 'secondary'}>3. OTP</Badge>
          </div>

          {step === 1 ? (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="rounded-md bg-stone-50 p-3 text-sm">
                <p className="font-medium">점수 요약</p>
                <p className="mt-1 text-stone-600">
                  총점 {scoreSummary.totalScore.toFixed(2)} / {scoreSummary.totalWeight.toFixed(2)}
                </p>
              </div>

              {requiredMissing.length > 0 ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <p className="font-medium">필수 항목 누락</p>
                  <ul className="mt-1 list-disc pl-5">
                    {requiredMissing.slice(0, 8).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">
                  모든 필수 항목 입력이 완료되었습니다.
                </div>
              )}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-2 rounded-lg border p-3">
              <Label>전자 서명</Label>
              <canvas
                ref={canvasRef}
                width={560}
                height={220}
                className="w-full rounded-md border bg-white"
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => signatureRef.current?.clear()}
                >
                  서명 지우기
                </Button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3 rounded-lg border p-3">
              {otpData && (
                <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
                  <p className="text-sm font-medium text-primary">인증번호: {otpData.code}</p>
                  <p className="text-xs text-stone-600">{otpData.instructions}</p>
                  <p className="text-xs text-stone-500">
                    전송 후 잠시 기다려주세요. SMS 수신 확인 후 인증번호를 입력하세요.
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="otp-code">OTP 인증번호</Label>
                <Input
                  id="otp-code"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  placeholder="6자리 인증번호"
                />
                <p className="text-xs text-stone-500">{evaluatorPhone} 번호로 인증번호를 전송합니다.</p>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => void requestOtp()}
                disabled={isOtpSending}
              >
                {isOtpSending ? 'OTP 전송 중...' : otpSent ? 'OTP 재전송' : 'OTP 전송'}
              </Button>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </div>

        <Separator />

        <DialogFooter>
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={() => setStep((step - 1) as 1 | 2 | 3)}>
              이전
            </Button>
          ) : null}

          {step === 1 ? (
            <Button
              type="button"
              onClick={() => setStep(2)}
              disabled={requiredMissing.length > 0}
            >
              다음
            </Button>
          ) : null}

          {step === 2 ? (
            <Button
              type="button"
              onClick={() => {
                if (!signatureRef.current || signatureRef.current.isEmpty()) {
                  setError('서명을 입력해 주세요')
                  return
                }

                setError(null)
                setStep(3)
              }}
            >
              OTP 인증으로 이동
            </Button>
          ) : null}

          {step === 3 ? (
            <Button
              type="button"
              onClick={() => void submitAndSign()}
              disabled={isSubmitting || otpCode.length !== 6}
            >
              {isSubmitting ? '제출 중...' : '제출 완료'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
