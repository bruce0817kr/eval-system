"use client"

import * as React from 'react'
import { ChevronDown, Eye, GripVertical, Plus, Trash2 } from 'lucide-react'

import { EvaluationFormPreview } from '@/components/admin/evaluation-form-preview'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  createNextItemId,
  createNextSectionId,
  defaultScoreOptions,
  type FormItem,
  type FormSchema,
} from '@/lib/form-template-schema'

type TemplateFormEditorProps = {
  schema: FormSchema
  onChange: (schema: FormSchema) => void
}

type FormItemType = FormItem['type']

function createItem(type: FormItemType, sectionId: string, nextId: string): FormItem {
  if (type === 'radio_score') {
    return {
      id: nextId,
      type,
      label: '새 점수 항목',
      description: '',
      options: defaultScoreOptions(),
      weight: 10,
      required: true,
    }
  }

  if (type === 'text') {
    return {
      id: nextId,
      type,
      label: '새 서술형 항목',
      description: '',
      required: true,
      maxLength: 1000,
    }
  }

  return {
    id: nextId,
    type,
    label: `${sectionId} 제목`,
    description: '',
  }
}

export function TemplateFormEditor({ schema, onChange }: TemplateFormEditorProps) {
  const [livePreview, setLivePreview] = React.useState(true)

  function updateSchema(updater: (prev: FormSchema) => FormSchema) {
    onChange(updater(schema))
  }

  function moveSection(sectionIndex: number, direction: -1 | 1) {
    updateSchema((prev) => {
      const next = [...prev.sections]
      const targetIndex = sectionIndex + direction

      if (targetIndex < 0 || targetIndex >= next.length) {
        return prev
      }

      const [current] = next.splice(sectionIndex, 1)
      next.splice(targetIndex, 0, current)
      return { ...prev, sections: next }
    })
  }

  function moveItem(sectionIndex: number, itemIndex: number, direction: -1 | 1) {
    updateSchema((prev) => {
      const nextSections = prev.sections.map((section, sIndex) => {
        if (sIndex !== sectionIndex) {
          return section
        }

        const nextItems = [...section.items]
        const targetIndex = itemIndex + direction

        if (targetIndex < 0 || targetIndex >= nextItems.length) {
          return section
        }

        const [current] = nextItems.splice(itemIndex, 1)
        nextItems.splice(targetIndex, 0, current)
        return { ...section, items: nextItems }
      })

      return { ...prev, sections: nextSections }
    })
  }

  return (
    <Tabs defaultValue="edit">
      <div className="mb-3 flex items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="edit">편집</TabsTrigger>
          <TabsTrigger value="preview">미리보기</TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-2 text-sm">
          <Eye className="size-4" />
          <span>라이브 미리보기</span>
          <Switch checked={livePreview} onCheckedChange={setLivePreview} />
        </div>
      </div>

      <TabsContent value="edit">
        <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <ScrollArea className="h-[calc(100vh-15rem)] rounded-lg border p-3">
            <div className="space-y-4">
              {schema.sections.map((section, sectionIndex) => (
                <Card key={section.id}>
                  <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <GripVertical className="size-4 text-muted-foreground" />
                        섹션 {sectionIndex + 1}
                      </CardTitle>

                      <div className="flex items-center gap-1">
                        <Button
                          size="icon-xs"
                          variant="outline"
                          disabled={sectionIndex === 0}
                          onClick={() => moveSection(sectionIndex, -1)}
                        >
                          ▲
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="outline"
                          disabled={sectionIndex === schema.sections.length - 1}
                          onClick={() => moveSection(sectionIndex, 1)}
                        >
                          <ChevronDown className="size-3" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="destructive"
                          disabled={schema.sections.length === 1}
                          onClick={() => {
                            updateSchema((prev) => ({
                              ...prev,
                              sections: prev.sections.filter((_, index) => index !== sectionIndex),
                            }))
                          }}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>섹션 ID</Label>
                        <Input
                          value={section.id}
                          onChange={(event) => {
                            const id = event.target.value
                            updateSchema((prev) => ({
                              ...prev,
                              sections: prev.sections.map((current, index) => {
                                if (index !== sectionIndex) {
                                  return current
                                }
                                return { ...current, id }
                              }),
                            }))
                          }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>섹션명</Label>
                        <Input
                          value={section.title}
                          onChange={(event) => {
                            const title = event.target.value
                            updateSchema((prev) => ({
                              ...prev,
                              sections: prev.sections.map((current, index) =>
                                index === sectionIndex ? { ...current, title } : current,
                              ),
                            }))
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>섹션 가중치: {section.weight}</Label>
                      <Slider
                        value={[section.weight]}
                        min={0}
                        max={100}
                        onValueChange={(value) => {
                          updateSchema((prev) => ({
                            ...prev,
                            sections: prev.sections.map((current, index) =>
                              index === sectionIndex
                                ? { ...current, weight: value[0] ?? current.weight }
                                : current,
                            ),
                          }))
                        }}
                      />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {section.items.map((item, itemIndex) => (
                      <div key={item.id} className="rounded-lg border p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <Badge variant="outline">항목 {itemIndex + 1}</Badge>

                          <div className="flex items-center gap-1">
                            <Button
                              size="icon-xs"
                              variant="outline"
                              disabled={itemIndex === 0}
                              onClick={() => moveItem(sectionIndex, itemIndex, -1)}
                            >
                              ▲
                            </Button>
                            <Button
                              size="icon-xs"
                              variant="outline"
                              disabled={itemIndex === section.items.length - 1}
                              onClick={() => moveItem(sectionIndex, itemIndex, 1)}
                            >
                              <ChevronDown className="size-3" />
                            </Button>
                            <Button
                              size="icon-xs"
                              variant="destructive"
                              onClick={() => {
                                updateSchema((prev) => ({
                                  ...prev,
                                  sections: prev.sections.map((current, index) => {
                                    if (index !== sectionIndex) {
                                      return current
                                    }
                                    return {
                                      ...current,
                                      items: current.items.filter((_, i) => i !== itemIndex),
                                    }
                                  }),
                                }))
                              }}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label>항목 ID</Label>
                            <Input
                              value={item.id}
                              onChange={(event) => {
                                const id = event.target.value
                                updateSchema((prev) => ({
                                  ...prev,
                                  sections: prev.sections.map((current, index) => {
                                    if (index !== sectionIndex) {
                                      return current
                                    }

                                    return {
                                      ...current,
                                      items: current.items.map((value, i) =>
                                        i === itemIndex ? { ...value, id } : value,
                                      ),
                                    }
                                  }),
                                }))
                              }}
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label>항목 유형</Label>
                            <Select
                              value={item.type}
                              onValueChange={(value) => {
                                if (
                                  value !== 'radio_score' &&
                                  value !== 'text' &&
                                  value !== 'heading'
                                ) {
                                  return
                                }

                                const type: FormItemType = value
                                updateSchema((prev) => ({
                                  ...prev,
                                  sections: prev.sections.map((current, index) => {
                                    if (index !== sectionIndex) {
                                      return current
                                    }

                                    return {
                                      ...current,
                                      items: current.items.map((target, i) => {
                                        if (i !== itemIndex) {
                                          return target
                                        }

                                        return createItem(type, current.id, target.id)
                                      }),
                                    }
                                  }),
                                }))
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="radio_score">radio_score</SelectItem>
                                <SelectItem value="text">text</SelectItem>
                                <SelectItem value="heading">heading</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="mt-3 space-y-1.5">
                          <Label>라벨</Label>
                          <Input
                            value={item.label}
                            onChange={(event) => {
                              const label = event.target.value
                              updateSchema((prev) => ({
                                ...prev,
                                sections: prev.sections.map((current, index) => {
                                  if (index !== sectionIndex) {
                                    return current
                                  }

                                  return {
                                    ...current,
                                    items: current.items.map((target, i) =>
                                      i === itemIndex ? { ...target, label } : target,
                                    ),
                                  }
                                }),
                              }))
                            }}
                          />
                        </div>

                        {item.type !== 'heading' ? (
                          <div className="mt-3 space-y-1.5">
                            <Label>설명</Label>
                            <Textarea
                              value={item.description ?? ''}
                              onChange={(event) => {
                                const description = event.target.value
                                updateSchema((prev) => ({
                                  ...prev,
                                  sections: prev.sections.map((current, index) => {
                                    if (index !== sectionIndex) {
                                      return current
                                    }

                                    return {
                                      ...current,
                                      items: current.items.map((target, i) =>
                                        i === itemIndex
                                          ? { ...target, description }
                                          : target,
                                      ),
                                    }
                                  }),
                                }))
                              }}
                            />
                          </div>
                        ) : null}

                        {item.type === 'radio_score' ? (
                          <>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label>배점</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={item.weight}
                                  onChange={(event) => {
                                    const weight = Number(event.target.value)
                                    updateSchema((prev) => ({
                                      ...prev,
                                      sections: prev.sections.map((current, index) => {
                                        if (index !== sectionIndex) {
                                          return current
                                        }

                                        return {
                                          ...current,
                                          items: current.items.map((target, i) =>
                                            i === itemIndex && target.type === 'radio_score'
                                              ? {
                                                  ...target,
                                                  weight: Number.isNaN(weight) ? 0 : weight,
                                                }
                                              : target,
                                          ),
                                        }
                                      }),
                                    }))
                                  }}
                                />
                              </div>

                              <div className="space-y-1.5">
                                <Label className="mb-1 block">필수 여부</Label>
                                <Switch
                                  checked={item.required}
                                  onCheckedChange={(checked) => {
                                    updateSchema((prev) => ({
                                      ...prev,
                                      sections: prev.sections.map((current, index) => {
                                        if (index !== sectionIndex) {
                                          return current
                                        }

                                        return {
                                          ...current,
                                          items: current.items.map((target, i) =>
                                            i === itemIndex && target.type === 'radio_score'
                                              ? { ...target, required: checked }
                                              : target,
                                          ),
                                        }
                                      }),
                                    }))
                                  }}
                                />
                              </div>
                            </div>

                            <Separator className="my-3" />

                            <div className="space-y-2">
                              <Label>점수 옵션</Label>
                              {item.options.map((option, optionIndex) => (
                                <div
                                  key={`${item.id}_${optionIndex}`}
                                  className="grid grid-cols-[90px_1fr_auto] gap-2"
                                >
                                  <Input
                                    type="number"
                                    value={option.score}
                                    onChange={(event) => {
                                      const score = Number(event.target.value)
                                      updateSchema((prev) => ({
                                        ...prev,
                                        sections: prev.sections.map((current, index) => {
                                          if (index !== sectionIndex) {
                                            return current
                                          }

                                          return {
                                            ...current,
                                            items: current.items.map((target, i) => {
                                              if (
                                                i !== itemIndex ||
                                                target.type !== 'radio_score'
                                              ) {
                                                return target
                                              }

                                              return {
                                                ...target,
                                                options: target.options.map((v, idx) =>
                                                  idx === optionIndex
                                                    ? {
                                                        ...v,
                                                        score: Number.isNaN(score)
                                                          ? 0
                                                          : score,
                                                      }
                                                    : v,
                                                ),
                                              }
                                            }),
                                          }
                                        }),
                                      }))
                                    }}
                                  />
                                  <Input
                                    value={option.label}
                                    onChange={(event) => {
                                      const label = event.target.value
                                      updateSchema((prev) => ({
                                        ...prev,
                                        sections: prev.sections.map((current, index) => {
                                          if (index !== sectionIndex) {
                                            return current
                                          }

                                          return {
                                            ...current,
                                            items: current.items.map((target, i) => {
                                              if (
                                                i !== itemIndex ||
                                                target.type !== 'radio_score'
                                              ) {
                                                return target
                                              }

                                              return {
                                                ...target,
                                                options: target.options.map((v, idx) =>
                                                  idx === optionIndex ? { ...v, label } : v,
                                                ),
                                              }
                                            }),
                                          }
                                        }),
                                      }))
                                    }}
                                  />
                                  <Button
                                    size="icon-xs"
                                    variant="outline"
                                    disabled={item.options.length <= 2}
                                    onClick={() => {
                                      updateSchema((prev) => ({
                                        ...prev,
                                        sections: prev.sections.map((current, index) => {
                                          if (index !== sectionIndex) {
                                            return current
                                          }

                                          return {
                                            ...current,
                                            items: current.items.map((target, i) =>
                                              i === itemIndex &&
                                              target.type === 'radio_score'
                                                ? {
                                                    ...target,
                                                    options: target.options.filter(
                                                      (_, idx) => idx !== optionIndex,
                                                    ),
                                                  }
                                                : target,
                                            ),
                                          }
                                        }),
                                      }))
                                    }}
                                  >
                                    <Trash2 className="size-3" />
                                  </Button>
                                </div>
                              ))}

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  updateSchema((prev) => ({
                                    ...prev,
                                    sections: prev.sections.map((current, index) => {
                                      if (index !== sectionIndex) {
                                        return current
                                      }

                                      return {
                                        ...current,
                                        items: current.items.map((target, i) =>
                                          i === itemIndex && target.type === 'radio_score'
                                            ? {
                                                ...target,
                                                options: [
                                                  ...target.options,
                                                  {
                                                    score:
                                                      (target.options[
                                                        target.options.length - 1
                                                      ]?.score ?? 0) + 1,
                                                    label: '새 옵션',
                                                  },
                                                ],
                                              }
                                            : target,
                                        ),
                                      }
                                    }),
                                  }))
                                }}
                              >
                                <Plus className="size-4" /> 옵션 추가
                              </Button>
                            </div>
                          </>
                        ) : null}

                        {item.type === 'text' ? (
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label>최대 글자수</Label>
                              <Input
                                type="number"
                                min={1}
                                value={item.maxLength ?? 1000}
                                onChange={(event) => {
                                  const maxLength = Number(event.target.value)
                                  updateSchema((prev) => ({
                                    ...prev,
                                    sections: prev.sections.map((current, index) => {
                                      if (index !== sectionIndex) {
                                        return current
                                      }

                                      return {
                                        ...current,
                                        items: current.items.map((target, i) =>
                                          i === itemIndex && target.type === 'text'
                                            ? {
                                                ...target,
                                                maxLength: Number.isNaN(maxLength)
                                                  ? undefined
                                                  : maxLength,
                                              }
                                            : target,
                                        ),
                                      }
                                    }),
                                  }))
                                }}
                              />
                            </div>

                            <div className="space-y-1.5">
                              <Label className="mb-1 block">필수 여부</Label>
                              <Switch
                                checked={item.required}
                                onCheckedChange={(checked) => {
                                  updateSchema((prev) => ({
                                    ...prev,
                                    sections: prev.sections.map((current, index) => {
                                      if (index !== sectionIndex) {
                                        return current
                                      }

                                      return {
                                        ...current,
                                        items: current.items.map((target, i) =>
                                          i === itemIndex && target.type === 'text'
                                            ? { ...target, required: checked }
                                            : target,
                                        ),
                                      }
                                    }),
                                  }))
                                }}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const nextId = createNextItemId(section)
                        updateSchema((prev) => ({
                          ...prev,
                          sections: prev.sections.map((current, index) =>
                            index === sectionIndex
                              ? {
                                  ...current,
                                  items: [
                                    ...current.items,
                                    createItem('radio_score', current.id, nextId),
                                  ],
                                }
                              : current,
                          ),
                        }))
                      }}
                    >
                      <Plus className="size-4" /> 항목 추가
                    </Button>
                  </CardContent>
                </Card>
              ))}

              <Button
                variant="secondary"
                onClick={() => {
                  const sectionId = createNextSectionId(schema)

                  updateSchema((prev) => ({
                    ...prev,
                    sections: [
                      ...prev.sections,
                      {
                        id: sectionId,
                        title: '새 섹션',
                        weight: 20,
                        items: [createItem('radio_score', sectionId, `${sectionId}_q1`)],
                      },
                    ],
                  }))
                }}
              >
                <Plus className="size-4" /> 섹션 추가
              </Button>
            </div>
          </ScrollArea>

          {livePreview ? <EvaluationFormPreview schema={schema} /> : null}
        </div>
      </TabsContent>

      <TabsContent value="preview">
        <EvaluationFormPreview schema={schema} />
      </TabsContent>
    </Tabs>
  )
}
