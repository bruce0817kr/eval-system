"use client"

import { useCallback, useMemo, useRef, useState } from 'react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'

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
  isReadOnly?: boolean
}

function saveStatusLabel(status: SaveStatus) {
  if (status === 'saving') return '저장 중...'
  if (status === 'saved') return '저장됨'
  if (status === 'error') return '저장 실패'
  return '저장 대기'
}

type SectionCompletion = {
  sectionId: string
  total: number
  filled: number
  isComplete: boolean
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
  isReadOnly,
}: EvaluationFormProps) {
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [defaultSections] = useState(() => new Set(schema.sections.map((s) => s.id)))

  const sectionCompletions = useMemo<SectionCompletion[]>(() => {
    return schema.sections.map((section) => {
      const items = section.items.filter(
        (item) => item.type === 'radio_score' || item.type === 'text',
      )
      const filled = items.filter((item) => {
        const value = answers[item.id]
        if (item.type === 'text') {
          return typeof value === 'string' && value.trim().length > 0
        }
        return typeof value === 'number'
      }).length
      return {
        sectionId: section.id,
        total: items.length,
        filled,
        isComplete: filled === items.length && items.length > 0,
      }
    })
  }, [schema.sections, answers])

  const overallProgress = useMemo(() => {
    const total = sectionCompletions.reduce((sum, s) => sum + s.total, 0)
    const filled = sectionCompletions.reduce((sum, s) => sum + s.filled, 0)
    return total > 0 ? (filled / total) * 100 : 0
  }, [sectionCompletions])

  const scrollToSection = useCallback((sectionId: string) => {
    const element = sectionRefs.current.get(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const setSectionRef = useCallback((sectionId: string, el: HTMLDivElement | null) => {
    if (el) {
      sectionRefs.current.set(sectionId, el)
    } else {
      sectionRefs.current.delete(sectionId)
    }
  }, [])



  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b bg-white p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-stone-600">
          <span>작성 진행률</span>
          <span>
            {sectionCompletions.reduce((sum, s) => sum + s.filled, 0)}/
            {sectionCompletions.reduce((sum, s) => sum + s.total, 0)}
          </span>
        </div>
        <Progress value={overallProgress} />

        <div className="mt-3 flex flex-wrap gap-1.5">
          {sectionCompletions.map((section) => {
            const sectionInfo = schema.sections.find((s) => s.id === section.sectionId)
            return (
              <button
                key={section.sectionId}
                type="button"
                onClick={() => scrollToSection(section.sectionId)}
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors ${
                  section.isComplete
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : section.filled > 0
                      ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <span
                  className={`size-4 rounded-full border ${
                    section.isComplete
                      ? 'border-green-600 bg-green-600'
                      : 'border-stone-400'
                  }`}
                >
                  {section.isComplete && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                      className="size-full"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span className="max-w-[80px] truncate">{sectionInfo?.title ?? '섹션'}</span>
              </button>
            )
          })}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-3">
          <Accordion
            defaultValue={Array.from(defaultSections)}
          >
            {schema.sections.map((section) => {
              const completion = sectionCompletions.find(
                (s) => s.sectionId === section.id,
              )
              const isComplete = completion?.isComplete ?? false
              const hasPartial = (completion?.filled ?? 0) > 0

              return (
                <AccordionItem
                  key={section.id}
                  value={section.id}
                  ref={(el) => setSectionRef(section.id, el)}
                >
                  <AccordionTrigger className="px-1">
                    <div className="flex w-full items-center justify-between gap-2 pr-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-5 rounded-full border-2 ${
                            isComplete
                              ? 'border-green-600 bg-green-600'
                              : hasPartial
                                ? 'border-yellow-500 bg-yellow-500'
                                : 'border-stone-300'
                          }`}
                        >
                          {isComplete && (
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="white"
                              strokeWidth="3"
                              className="size-full"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                        <span className={isComplete ? 'text-green-700' : ''}>
                          {section.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-500">
                          {completion?.filled ?? 0}/{completion?.total ?? 0}
                        </span>
                        <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">
                          가중치 {section.weight}
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 rounded-md border bg-white p-3">
                      {section.items.map((item) => {
                        if (item.type === 'heading') {
                          return (
                            <div key={item.id} className="rounded-md bg-stone-50 px-3 py-2">
                              <p className="text-sm font-semibold text-stone-900">
                                {item.label}
                              </p>
                              {item.description ? (
                                <p className="mt-1 text-xs text-stone-500">
                                  {item.description}
                                </p>
                              ) : null}
                            </div>
                          )
                        }

                        if (item.type === 'text') {
                          const isFilled =
                            typeof answers[item.id] === 'string' &&
                            String(answers[item.id]).trim().length > 0
                          return (
                            <div key={item.id} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Label htmlFor={item.id}>
                                  {item.label}
                                  {item.required ? (
                                    <span className="ml-1 text-destructive">*</span>
                                  ) : null}
                                </Label>
                                {isFilled && (
                                  <span className="size-2 rounded-full bg-green-500" />
                                )}
                              </div>
                              {item.description ? (
                                <p className="text-xs text-stone-500">
                                  {item.description}
                                </p>
                              ) : null}
                              <Textarea
                                id={item.id}
                                aria-label={item.label}
                                value={
                                  typeof answers[item.id] === 'string'
                                    ? String(answers[item.id])
                                    : ''
                                }
                                onChange={(event) =>
                                  onAnswerChange(item.id, event.target.value)
                                }
                                onBlur={onFieldBlur}
                                maxLength={item.maxLength}
                                placeholder="의견을 입력하세요"
                                rows={4}
                                readOnly={Boolean(isReadOnly)}
                                disabled={Boolean(isReadOnly)}
                              />
                            </div>
                          )
                        }

                        const currentValue = answers[item.id]
                        const valueAsString =
                          typeof currentValue === 'number'
                            ? String(currentValue)
                            : undefined

                        return (
                          <div key={item.id} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label>
                                {item.label}
                                {item.required ? (
                                  <span className="ml-1 text-destructive">*</span>
                                ) : null}
                              </Label>
                              <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">
                                배점 {item.weight}
                              </span>
                              {typeof currentValue === 'number' && (
                                <span className="size-2 rounded-full bg-green-500" />
                              )}
                            </div>
                            {item.description ? (
                              <p className="text-xs text-stone-500">
                                {item.description}
                              </p>
                            ) : null}
                            <RadioGroup
                              value={valueAsString}
                              disabled={Boolean(isReadOnly)}
                              onValueChange={(value) => {
                                if (isReadOnly) return
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
                                    <RadioGroupItem
                                      id={optionId}
                                      value={String(option.score)}
                                      disabled={Boolean(isReadOnly)}
                                    />
                                    <span className="font-medium">{option.score}점</span>
                                    <span className="text-stone-600">{option.label}</span>
                                  </label>
                                )
                              })}
                            </RadioGroup>
                            {isReadOnly ? (
                              <div className="sr-only">
                                {item.options.map((option) => (
                                  <input
                                    key={`${item.id}-readonly-${option.score}`}
                                    aria-label={option.label}
                                    disabled
                                    readOnly
                                    value={option.score}
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t bg-white p-3">
        <div className="mb-2 text-xs text-stone-500">
          {saveStatusLabel(saveStatus)}
        </div>
        <Separator className="mb-3" />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onSaveDraft}
            disabled={isSaving || Boolean(isReadOnly)}
          >
            초안 저장
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={onSubmit}
            disabled={Boolean(isSubmitDisabled) || Boolean(isReadOnly)}
          >
            최종 제출
          </Button>
        </div>
      </div>
    </div>
  )
}
