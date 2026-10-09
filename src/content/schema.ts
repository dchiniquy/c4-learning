import { z } from 'zod'

export const GRADES = ['prek', 'k', '1', '2', '3'] as const
export const GradeSchema = z.enum(GRADES)
export type Grade = z.infer<typeof GradeSchema>

/** Typical age for each grade level. */
export const GRADE_AGE: Record<Grade, number> = { prek: 4, k: 5, '1': 6, '2': 7, '3': 8 }

/**
 * Maximum app/screen minutes per day, per grade. These are our own product
 * recommendations (WHO caps sedentary screen time at 1 hr/day under age 5),
 * not a published standard. Schedule templates over budget fail validation.
 */
export const SCREEN_BUDGET_MINUTES: Record<Grade, number> = {
  prek: 30,
  k: 40,
  '1': 60,
  '2': 60,
  '3': 60,
}

export const SUBJECTS = [
  'literacy',
  'math',
  'science',
  'social-studies',
  'sel',
  'arts',
  'movement',
  'life-skills',
] as const
export const SubjectSchema = z.enum(SUBJECTS)
export type Subject = z.infer<typeof SubjectSchema>

const id = z.string().regex(/^[a-z0-9][a-z0-9._-]*$/, 'ids are lowercase letters, digits, . _ -')

export const FRAMEWORKS = ['ccss-ela', 'ccss-math', 'ngss', 'c3', 'casel', 'elof', 'tx-prek'] as const

/**
 * A published learning standard. `verified` must be true only after the code
 * and wording were checked against the official source (see `source`).
 * Lessons may not reference unverified standards.
 */
export const StandardSchema = z.object({
  id,
  framework: z.enum(FRAMEWORKS),
  code: z.string().min(1),
  description: z.string().min(1),
  grade: GradeSchema,
  source: z.url(),
  verified: z.boolean(),
})
export type Standard = z.infer<typeof StandardSchema>

export const SkillSchema = z.object({
  id,
  subject: SubjectSchema,
  name: z.string().min(1),
  prerequisites: z.array(id).default([]),
  standardIds: z.array(id).default([]),
})
export type Skill = z.infer<typeof SkillSchema>

export const ACTIVITY_TYPES = [
  'tap-to-hear',
  'sort',
  'number-line',
  'ten-frame',
  'multiple-choice',
  'read-aloud',
  'video',
  'offline-task',
] as const

/** Offline activities are first-class: parent-led, with materials and prompts. */
export const ActivitySchema = z.object({
  id,
  type: z.enum(ACTIVITY_TYPES),
  mode: z.enum(['screen', 'offline']),
  leadBy: z.enum(['app', 'parent']),
  title: z.string().min(1),
  minutes: z.number().int().positive(),
  materials: z.array(z.string()).default([]),
  parentPrompts: z.array(z.string()).default([]),
  /** Instruction shown on screen and spoken aloud (recorded clip if `audio` exists, else browser speech). */
  prompt: z.string().min(1).optional(),
  /** Recorded narration under public/audio, e.g. "pk/count-apples.mp3". Optional: speech is the fallback. */
  audio: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
})
export type Activity = z.infer<typeof ActivitySchema>

export const LessonSchema = z.object({
  id,
  grade: GradeSchema,
  subject: SubjectSchema,
  unit: id,
  title: z.string().min(1),
  /** Bump when content changes meaningfully; progress records reference lesson id + version. */
  version: z.number().int().positive(),
  skillIds: z.array(id).min(1),
  activities: z.array(ActivitySchema).min(1),
})
export type Lesson = z.infer<typeof LessonSchema>

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'use 24h HH:MM')

/**
 * An ordered run of lessons for one subject. A schedule block that points at a
 * sequence shows the first lesson the child hasn't finished yet, so a missed
 * day never leaves them behind.
 */
export const SequenceSchema = z.object({
  id,
  grade: GradeSchema,
  subject: SubjectSchema,
  name: z.string().min(1),
  lessonIds: z.array(id).min(1),
})
export type Sequence = z.infer<typeof SequenceSchema>

export const ScheduleBlockSchema = z
  .object({
  day: z.number().int().min(1).max(7), // 1 = Monday
  start: HHMM,
  minutes: z.number().int().positive(),
  subject: SubjectSchema,
  mode: z.enum(['screen', 'offline']),
  leadBy: z.enum(['app', 'parent']),
  label: z.string().min(1),
  /** A fixed lesson (e.g. a repeatable game), or a sequence that advances as lessons are finished. Not both. */
  lessonId: id.optional(),
  sequenceId: id.optional(),
  })
  .refine((b) => !(b.lessonId && b.sequenceId), { message: 'a block can have lessonId or sequenceId, not both', path: ['sequenceId'] })
export type ScheduleBlock = z.infer<typeof ScheduleBlockSchema>

export const ScheduleTemplateSchema = z.object({
  id,
  grade: GradeSchema,
  name: z.string().min(1),
  blocks: z.array(ScheduleBlockSchema).min(1),
})
export type ScheduleTemplate = z.infer<typeof ScheduleTemplateSchema>

export type ContentBundle = {
  standards: Standard[]
  skills: Skill[]
  lessons: Lesson[]
  sequences: Sequence[]
  schedules: ScheduleTemplate[]
}
