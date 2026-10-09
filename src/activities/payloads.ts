import { z } from 'zod'
import type { Activity } from '../content/schema.ts'

const id = z.string().min(1)

export const TapToHearPayload = z.object({
  items: z.array(z.object({ id, label: z.string().min(1), emoji: z.string().optional(), speak: z.string().optional() })).min(1),
})

export const MultipleChoicePayload = z
  .object({
    /** Large visual shown above the choices, e.g. a row of emoji to count. */
    stem: z.string().optional(),
    choices: z.array(z.object({ id, label: z.string().min(1), emoji: z.string().optional() })).min(2),
    correctId: id,
  })
  .refine((p) => p.choices.some((c) => c.id === p.correctId), { message: 'correctId must match one of the choices', path: ['correctId'] })

export const SortPayload = z
  .object({
    categories: z.array(z.object({ id, label: z.string().min(1) })).min(2),
    items: z.array(z.object({ id, label: z.string().min(1), categoryId: id })).min(2),
  })
  .refine((p) => p.items.every((i) => p.categories.some((c) => c.id === i.categoryId)), {
    message: 'every item needs a categoryId that matches a category',
    path: ['items'],
  })

export const TenFramePayload = z.object({
  /** Each round starts with `start` counters already placed; the child fills the rest to ten. */
  rounds: z.array(z.object({ start: z.number().int().min(0).max(9) })).min(1),
})

export const NumberLinePayload = z
  .object({ min: z.number().int(), max: z.number().int(), target: z.number().int() })
  .refine((p) => p.min < p.max && p.max - p.min <= 20, { message: 'min < max, and at most 21 numbers', path: ['max'] })
  .refine((p) => p.target >= p.min && p.target <= p.max, { message: 'target must be on the line', path: ['target'] })

export const PAYLOAD_SCHEMAS = {
  'tap-to-hear': TapToHearPayload,
  'multiple-choice': MultipleChoicePayload,
  sort: SortPayload,
  'ten-frame': TenFramePayload,
  'number-line': NumberLinePayload,
} as const

export type InteractiveType = keyof typeof PAYLOAD_SCHEMAS
export const isInteractive = (type: Activity['type']): type is InteractiveType => type in PAYLOAD_SCHEMAS

export type TapToHear = z.infer<typeof TapToHearPayload>
export type MultipleChoice = z.infer<typeof MultipleChoicePayload>
export type Sort = z.infer<typeof SortPayload>
export type TenFrame = z.infer<typeof TenFramePayload>
export type NumberLine = z.infer<typeof NumberLinePayload>
