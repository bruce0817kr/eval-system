"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import type { FormSchema } from '@/lib/form-template-schema'

type EvaluationFormPreviewProps = {
  schema: FormSchema
}

export function EvaluationFormPreview({ schema }: EvaluationFormPreviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>평가표 미리보기</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion defaultValue={schema.sections[0]?.id ? [schema.sections[0].id] : []}>
          {schema.sections.map((section) => (
            <AccordionItem key={section.id} value={section.id}>
              <AccordionTrigger>
                <div className="flex w-full items-center justify-between pr-2">
                  <span>{section.title}</span>
                  <Badge variant="outline">가중치 {section.weight}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  {section.items.map((item, index) => (
                    <div key={item.id} className="space-y-2 rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {index + 1}. {item.label}
                          </p>
                          {item.description ? (
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          ) : null}
                        </div>
                        {item.type === 'radio_score' ? (
                          <Badge>{item.weight}점</Badge>
                        ) : null}
                      </div>

                      {item.type === 'radio_score' ? (
                        <>
                          <RadioGroup defaultValue={item.options[0]?.score.toString()} disabled>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {item.options.map((option) => (
                                <label
                                  key={`${item.id}_${option.score}`}
                                  className="rounded-md border bg-muted/40 px-2 py-1 text-xs"
                                >
                                  {option.score}점 · {option.label}
                                </label>
                              ))}
                            </div>
                          </RadioGroup>
                          <p className="text-xs text-muted-foreground">
                            점수 범위: {item.options[0]?.score ?? 0} ~{' '}
                            {item.options[item.options.length - 1]?.score ?? 0}
                          </p>
                        </>
                      ) : null}

                      {item.type === 'text' ? (
                        <Textarea
                          disabled
                          value=""
                          placeholder={
                            item.maxLength
                              ? `최대 ${item.maxLength}자까지 입력`
                              : '의견을 입력하세요'
                          }
                        />
                      ) : null}

                      {item.type === 'heading' ? (
                        <div className="rounded-md bg-muted px-3 py-2 text-sm font-semibold">
                          {item.label}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <Separator className="my-3" />
                <p className="text-xs text-muted-foreground">
                  섹션 가중치: {section.weight} / 항목 수: {section.items.length}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  )
}
