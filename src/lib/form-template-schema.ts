import { z } from 'zod'

export const optionSchema = z.object({
  score: z.number().min(0),
  label: z.string().trim().min(1, '옵션 라벨을 입력해주세요'),
})

const baseItemSchema = z.object({
  id: z.string().trim().min(1, '항목 ID가 필요합니다'),
  label: z.string().trim().min(1, '항목명을 입력해주세요'),
  description: z.string().trim().optional(),
})

export const radioScoreItemSchema = baseItemSchema.extend({
  type: z.literal('radio_score'),
  options: z.array(optionSchema).min(1, '점수 옵션이 필요합니다'),
  weight: z.number().min(0),
  required: z.boolean().default(true),
})

export const textItemSchema = baseItemSchema.extend({
  type: z.literal('text'),
  required: z.boolean().default(false),
  maxLength: z.number().int().min(1).max(5000).optional(),
})

export const headingItemSchema = baseItemSchema.extend({
  type: z.literal('heading'),
})

export const formItemSchema = z.discriminatedUnion('type', [
  radioScoreItemSchema,
  textItemSchema,
  headingItemSchema,
])

export const formSectionSchema = z.object({
  id: z.string().trim().min(1, '섹션 ID가 필요합니다'),
  title: z.string().trim().min(1, '섹션명을 입력해주세요'),
  weight: z.number().min(0),
  items: z.array(formItemSchema).min(1, '섹션에는 최소 1개 항목이 필요합니다'),
})

export const formSchemaSchema = z.object({
  sections: z.array(formSectionSchema).min(1, '섹션을 최소 1개 추가해주세요'),
})

export type FormItem = z.infer<typeof formItemSchema>
export type FormSection = z.infer<typeof formSectionSchema>
export type FormSchema = z.infer<typeof formSchemaSchema>

export function calculateTemplateStats(schema: FormSchema) {
  let totalScore = 0
  let itemsCount = 0

  for (const section of schema.sections) {
    for (const item of section.items) {
      if (item.type === 'heading') {
        continue
      }

      itemsCount += 1

      if (item.type === 'radio_score') {
        totalScore += item.weight
      }
    }
  }

  return {
    totalScore,
    itemsCount,
  }
}

export function validateSchemaForSave(schema: FormSchema) {
  const errors: string[] = []
  const sectionIds = new Set<string>()
  const itemIds = new Set<string>()

  schema.sections.forEach((section, sectionIndex) => {
    if (sectionIds.has(section.id)) {
      errors.push(`중복된 섹션 ID가 있습니다: ${section.id}`)
    }
    sectionIds.add(section.id)

    if (!section.items.length) {
      errors.push(`${sectionIndex + 1}번 섹션에 항목이 없습니다`)
    }

    section.items.forEach((item, itemIndex) => {
      if (itemIds.has(item.id)) {
        errors.push(`중복된 항목 ID가 있습니다: ${item.id}`)
      }
      itemIds.add(item.id)

      if ((item.type === 'radio_score' || item.type === 'text') && !item.label.trim()) {
        errors.push(
          `${sectionIndex + 1}번 섹션 ${itemIndex + 1}번 항목 라벨을 입력해주세요`,
        )
      }
    })
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function getDefaultTemplateSchema(): FormSchema {
  return {
    sections: [
      {
        id: 's1',
        title: '사업성 평가',
        weight: 40,
        items: [
          {
            id: 's1_q1',
            type: 'radio_score',
            label: '시장 수요와 고객 문제의 명확성',
            description: '해결하려는 고객 문제와 시장 규모가 구체적인지 평가',
            options: defaultScoreOptions(),
            weight: 10,
            required: true,
          },
          {
            id: 's1_q2',
            type: 'radio_score',
            label: '수익모델의 실현 가능성',
            description: '매출 구조와 단가 정책이 현실적인지 평가',
            options: defaultScoreOptions(),
            weight: 15,
            required: true,
          },
          {
            id: 's1_q3',
            type: 'text',
            label: '사업성 종합 의견',
            description: '사업성 관련 강점/리스크를 자유롭게 작성',
            required: true,
            maxLength: 1200,
          },
        ],
      },
      {
        id: 's2',
        title: '기술성 평가',
        weight: 35,
        items: [
          {
            id: 's2_q1',
            type: 'radio_score',
            label: '핵심기술 차별성',
            description: '경쟁사 대비 기술 차별성과 진입장벽 수준 평가',
            options: defaultScoreOptions(),
            weight: 15,
            required: true,
          },
          {
            id: 's2_q2',
            type: 'radio_score',
            label: '기술 구현 완성도',
            description: '시제품/PoC 수준 및 실제 구현 역량 평가',
            options: defaultScoreOptions(),
            weight: 10,
            required: true,
          },
          {
            id: 's2_q3',
            type: 'text',
            label: '기술 리스크 및 보완 의견',
            description: '기술 검증 이슈와 보완 제안을 작성',
            required: false,
            maxLength: 1000,
          },
        ],
      },
      {
        id: 's3',
        title: '경영성 평가',
        weight: 25,
        items: [
          {
            id: 's3_q1',
            type: 'radio_score',
            label: '대표자 및 핵심팀 역량',
            description: '대표자 경력, 팀 구성, 실행 역량을 평가',
            options: defaultScoreOptions(),
            weight: 10,
            required: true,
          },
          {
            id: 's3_q2',
            type: 'radio_score',
            label: '자금 운용 계획의 적정성',
            description: '예산 계획과 자금 집행 전략의 타당성 평가',
            options: defaultScoreOptions(),
            weight: 10,
            required: true,
          },
          {
            id: 's3_q3',
            type: 'text',
            label: '최종 추천 의견',
            description: '투자/지원 적합성에 대한 최종 의견 작성',
            required: true,
            maxLength: 1000,
          },
        ],
      },
    ],
  }
}

export function getBlankTemplateSchema(): FormSchema {
  return {
    sections: [
      {
        id: 's1',
        title: '새 섹션',
        weight: 100,
        items: [
          {
            id: 's1_q1',
            type: 'text',
            label: '새 항목',
            required: true,
            maxLength: 1000,
          },
        ],
      },
    ],
  }
}

export function defaultScoreOptions() {
  return [
    { score: 1, label: '매우 부족' },
    { score: 2, label: '부족' },
    { score: 3, label: '보통' },
    { score: 4, label: '우수' },
    { score: 5, label: '매우 우수' },
  ]
}

export function createNextSectionId(schema: FormSchema) {
  const max = schema.sections.reduce((acc, section) => {
    const match = section.id.match(/^s(\d+)$/)
    if (!match) {
      return acc
    }
    return Math.max(acc, Number(match[1]))
  }, 0)

  return `s${max + 1}`
}

export function createNextItemId(section: FormSection) {
  const prefix = `${section.id}_q`
  const max = section.items.reduce((acc, item) => {
    const match = item.id.match(new RegExp(`^${prefix}(\\d+)$`))
    if (!match) {
      return acc
    }
    return Math.max(acc, Number(match[1]))
  }, 0)

  return `${prefix}${max + 1}`
}
