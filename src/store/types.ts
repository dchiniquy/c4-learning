import { z } from 'zod'
import { GradeSchema } from '../content/schema.ts'

export const AVATARS = ['🦊', '🐼', '🐸', '🦁', '🐙', '🦋', '🐢', '🐳'] as const

/** Child profiles hold no birthdate, email or photo: just a nickname, avatar and grade. */
export const ChildSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(30),
  avatar: z.string().min(1),
  grade: GradeSchema,
  createdAt: z.number().int(),
})
export type Child = z.infer<typeof ChildSchema>
export type NewChild = Pick<Child, 'name' | 'avatar' | 'grade'>

export const ProgressRecordSchema = z.object({
  childId: z.string().min(1),
  activityId: z.string().min(1),
  lessonId: z.string().min(1),
  lessonVersion: z.number().int().positive(),
  status: z.enum(['not-started', 'in-progress', 'done']),
  attempts: z.number().int().min(0),
  timeSpentSec: z.number().int().min(0),
  completedAt: z.number().int().optional(),
  updatedAt: z.number().int(),
})
export type ProgressRecord = z.infer<typeof ProgressRecordSchema>

export const MASTERY_LEVELS = ['not-started', 'practicing', 'proficient', 'mastered'] as const
export const SkillMasterySchema = z.object({
  childId: z.string().min(1),
  skillId: z.string().min(1),
  level: z.enum(MASTERY_LEVELS),
  lastReviewedAt: z.number().int().optional(),
})
export type SkillMastery = z.infer<typeof SkillMasterySchema>

/** Parent PIN, stored as a salted hash. This is a gate against kids tapping into the parent area, not a security boundary. */
export const PinRecordSchema = z.object({
  salt: z.string(),
  hash: z.string(),
  iterations: z.number().int().positive(),
})
export type PinRecord = z.infer<typeof PinRecordSchema>

/** Backup file. The PIN is deliberately excluded so a shared backup can't unlock the parent area. */
export const ExportDataSchema = z.object({
  app: z.literal('c4-learning'),
  version: z.literal(1),
  exportedAt: z.number().int(),
  children: z.array(ChildSchema),
  progress: z.array(ProgressRecordSchema),
  mastery: z.array(SkillMasterySchema),
})
export type ExportData = z.infer<typeof ExportDataSchema>
