"use client"

import { useMemo } from 'react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { type FormSchema } from '@/lib/form-template-schema'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type EvaluationFormProps = {
  schema: FormSchema
  answers: Record<string, unknown>
  onAnswerChange: (itemId: string, value: unknown) => void
  onFieldBlur: () => void
  onSaveDraft: () => void
  onSubmit: () => void
  saveStatus: SaveStatus
  isSaving: boolean
  isSubmitDisabled?: boolean
}

function saveStatusLabel(status: SaveStatus) {
  if (status === 'saving') {
    return '저장 중...'
  }

  if (status === 'saved') {
    return '저장됨'
  }

  if (status === 'error') {
    return '저장 실패'
  }

  return '저장 대기'
}

export function EvaluationForm({
  schema,
  answers,
  onAnswerChange,
  onFieldBlur,
  onSaveDraft,
  onSubmit,
  saveStatus,
  isSaving,
  isSubmitDisabled,
}: EvaluationFormProps) {
  const scoreItems = useMemo(
    () =>
      schema.sections.flatMap((section) =>
        section.items.filter((item) => item.type === 'radio_score' || item.type === 'text'),
      ),
    [schema.sections],
  )
  const filledCount = scoreItems.filter((item) => {
    const value = answers[item.id]

    if (item.type === 'text') {
      return typeof value === 'string' && value.trim().length > 0
    }

    return typeof value === 'number'
  }).length

  const progress = scoreItems.length > 0 ? (filledCount / scoreItems.length) * 100 : 0

  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-white p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-stone-600">
          <span>작성 진행률</span>
          <span>{filledCount}/{scoreItems.length}</span>
        </div>
        <Progress value={progress} />
      </div>

      <ScrollArea className="h-[calc(100%-116px)]">
        <div className="space-y-4 p-3">
          <Accordion defaultValue={schema.sections.map((section) => section.id)}>
            {schema.sections.map((section) => (
              <AccordionItem key={section.id} value={section.id}>
                <AccordionTrigger className="px-1">
                  <div className="flex w-full items-center justify-between gap-2 pr-2">
                    <span>{section.title}</span>
                    <span className="text-xs text-stone-500">가중치 {section.weight}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 rounded-md border bg-white p-3">
                    {section.items.map((item) => {
                      if (item.type === 'heading') {
                        return (
                          <div key={item.id} className="rounded-md bg-stone-50 px-3 py-2">
                            <p className="text-sm font-semibold text-stone-900">{item.label}</p>
                            {item.description ? (
                              <p className="mt-1 text-xs text-stone-500">{item.description}</p>
                            ) : null}
                          </div>
                        )
                      }

                      if (item.type === 'text') {
                        return (
                          <div key={item.id} className="space-y-2">
                            <Label htmlFor={item.id}>
                              {item.label}
                              {item.required ? <span className="ml-1 text-destructive">*</span> : null}
                            </Label>
                            {item.description ? (
                              <p className="text-xs text-stone-500">{item.description}</p>
                            ) : null}
                            <Textarea
                              id={item.id}
                              value={typeof answers[item.id] === 'string' ? String(answers[item.id]) : ''}
                              onChange={(event) => onAnswerChange(item.id, event.target.value)}
                              onBlur={onFieldBlur}
                              maxLength={item.maxLength}
                              placeholder="의견을 입력하세요"
                              rows={4}
                            />
                          </div>
                        )
                      }

                      const currentValue = answers[item.id]
                      const valueAsString = typeof currentValue === 'number' ? String(currentValue) : undefined

                      return (
                        <div key={item.id} className="space-y-2">
                          <Label>
                            {item.label}
                            {item.required ? <span className="ml-1 text-destructive">*</span> : null}
                          </Label>
                          {item.description ? (
                            <p className="text-xs text-stone-500">{item.description}</p>
                          ) : null}
                          <RadioGroup
                            value={valueAsString}
                            onValueChange={(value) => {
                              onAnswerChange(item.id, Number(value))
                              onFieldBlur()
                            }}
                            className="gap-2"
                          >
                            {item.options.map((option) => {
                              const optionId = `${item.id}-${option.score}`

                              return (
                                <label
                                  key={optionId}
                                  htmlFor={optionId}
                                  className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition hover:bg-stone-50"
                                >
                                  <RadioGroupItem id={optionId} value={String(option.score)} />
                                  <span className="font-medium">{option.score}점</span>
                                  <span className="text-stone-600">{option.label}</span>
                                </label>
                              )
                            })}
                          </RadioGroup>
                        </div>
                      )
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </ScrollArea>

      <div className="sticky bottom-0 border-t bg-white p-3">
        <div className="mb-2 text-xs text-stone-500">{saveStatusLabel(saveStatus)}</div>
        <Separator className="mb-3" />
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onSaveDraft} disabled={isSaving}>
            초안 저장
          </Button>
          <Button type="button" className="flex-1" onClick={onSubmit} disabled={Boolean(isSubmitDisabled)}>
            최종 제출
          </Button>
        </div>
      </div>
    </div>
  )
}
