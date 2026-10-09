import { describe, expect, it } from 'vitest'
import { LessonSchema, ScheduleBlockSchema, StandardSchema, type ContentBundle } from './schema'
import { validateContent } from './validate'

// Synthetic fixtures for exercising the validator. Not real curriculum content.
const standard = { id: 'std-a', framework: 'ccss-math', code: 'TEST.1', description: 'test', grade: '1', source: 'https://example.com/s', verified: true } as const
const skill = { id: 'skill-a', subject: 'math', name: 'Test skill', prerequisites: [], standardIds: ['std-a'] } as const
const lesson = {
  id: 'lesson-a', grade: '1', subject: 'math', unit: 'unit-1', title: 'Test lesson', version: 1, skillIds: ['skill-a'],
  activities: [{ id: 'act-a', type: 'offline-task', mode: 'offline', leadBy: 'parent', title: 'Count beans', minutes: 10, materials: [], parentPrompts: [], payload: {} }],
} as const
const schedule = {
  id: 'sched-a', grade: '1', name: 'Test week',
  blocks: [{ day: 1, start: '09:00', minutes: 15, subject: 'math', mode: 'screen', leadBy: 'app', label: 'Math app', lessonId: 'lesson-a' }],
} as const

const bundle = (over: Partial<ContentBundle> = {}): ContentBundle =>
  structuredClone({
    standards: [standard], skills: [skill], lessons: [lesson], sequences: [], schedules: [schedule], ...over,
  }) as unknown as ContentBundle

describe('validateContent', () => {
  it('accepts a consistent bundle', () => {
    expect(validateContent(bundle())).toEqual([])
  })

  it('accepts an empty bundle', () => {
    expect(validateContent({ standards: [], skills: [], lessons: [], sequences: [], schedules: [] })).toEqual([])
  })

  it('flags duplicate ids and unknown references', () => {
    const b = bundle()
    b.skills.push({ ...b.skills[0] })
    b.skills[0].standardIds = ['nope']
    const errors = validateContent(b)
    expect(errors).toContain('duplicate skill id "skill-a"')
    expect(errors.some((e) => e.includes('unknown standard "nope"'))).toBe(true)
  })

  it('rejects lessons that rely on unverified standards', () => {
    const b = bundle()
    b.standards[0].verified = false
    expect(validateContent(b).some((e) => e.includes('unverified standard'))).toBe(true)
  })

  it('detects prerequisite cycles', () => {
    const b = bundle()
    b.skills = [
      { ...b.skills[0], id: 'a', prerequisites: ['b'] },
      { ...b.skills[0], id: 'b', prerequisites: ['a'] },
    ]
    b.lessons[0].skillIds = ['a']
    expect(validateContent(b).some((e) => e.startsWith('prerequisite cycle'))).toBe(true)
  })

  it('requires audio on screen activities for pre-K and K', () => {
    const b = bundle()
    b.lessons[0].grade = 'prek'
    b.lessons[0].activities[0] = { ...b.lessons[0].activities[0], mode: 'screen', leadBy: 'app', type: 'tap-to-hear' }
    expect(validateContent(b).some((e) => e.includes('needs a prompt or audio'))).toBe(true)
  })

  it('accepts a spoken prompt in place of recorded audio', () => {
    const b = bundle()
    b.lessons[0].grade = 'prek'
    b.schedules[0].grade = 'prek'
    b.lessons[0].activities[0] = {
      ...b.lessons[0].activities[0], mode: 'screen', leadBy: 'app', type: 'multiple-choice',
      prompt: 'How many?',
      payload: { choices: [{ id: 'a', label: '2' }, { id: 'b', label: '3' }], correctId: 'b' },
    }
    expect(validateContent(b)).toEqual([])
  })

  it('checks payloads of interactive screen activities', () => {
    const b = bundle()
    b.lessons[0].activities[0] = {
      ...b.lessons[0].activities[0], mode: 'screen', leadBy: 'app', type: 'multiple-choice',
      prompt: 'How many?',
      payload: { choices: [{ id: 'a', label: '2' }, { id: 'b', label: '3' }], correctId: 'zzz' },
    }
    expect(validateContent(b).some((e) => e.includes('payload.correctId'))).toBe(true)
    b.lessons[0].activities[0].prompt = undefined
    expect(validateContent(b).some((e) => e.includes('needs a prompt'))).toBe(true)
  })

  it('rejects offline activities led by the app', () => {
    const b = bundle()
    b.lessons[0].activities[0].leadBy = 'app'
    expect(validateContent(b).some((e) => e.includes('offline but led by the app'))).toBe(true)
  })

  it('enforces the per-grade daily screen budget', () => {
    const b = bundle()
    b.schedules[0].grade = '1'
    b.schedules[0].blocks = [
      { ...b.schedules[0].blocks[0], minutes: 35 },
      { ...b.schedules[0].blocks[0], start: '10:00', minutes: 30 },
    ]
    expect(validateContent(b).some((e) => e.includes('exceeds 1 budget of 60'))).toBe(true)
  })

  it('flags overlapping blocks and cross-grade lessons', () => {
    const b = bundle()
    b.schedules[0].grade = 'k'
    b.schedules[0].blocks = [
      { ...b.schedules[0].blocks[0], minutes: 20 },
      { ...b.schedules[0].blocks[0], start: '09:10', minutes: 10, lessonId: undefined, label: 'Next' },
    ]
    const errors = validateContent(b)
    expect(errors.some((e) => e.includes('overlaps'))).toBe(true)
    expect(errors.some((e) => e.includes('from grade 1'))).toBe(true)
  })
})

describe('sequences', () => {
  const seq = { id: 'seq-a', grade: '1', subject: 'math', name: 'Seq', lessonIds: ['lesson-a'] } as const

  it('accepts a sequence of matching lessons used by a matching schedule', () => {
    const b = bundle({ sequences: [structuredClone(seq) as never] })
    delete (b.schedules[0].blocks[0] as { lessonId?: string }).lessonId
    b.schedules[0].blocks[0].sequenceId = 'seq-a'
    expect(validateContent(b)).toEqual([])
  })

  it('flags unknown lessons, grade or subject mismatches, and repeats', () => {
    const b = bundle({ sequences: [{ ...structuredClone(seq), subject: 'literacy', lessonIds: ['lesson-a', 'lesson-a', 'nope'] } as never] })
    const errors = validateContent(b)
    expect(errors.some((e) => e.includes('unknown lesson "nope"'))).toBe(true)
    expect(errors.some((e) => e.includes('includes "lesson-a"'))).toBe(true)
    expect(errors.some((e) => e.includes('lists a lesson twice'))).toBe(true)
  })

  it('flags blocks that use an unknown sequence or one from another grade', () => {
    const b = bundle({ sequences: [{ ...structuredClone(seq), grade: 'k' } as never] })
    b.schedules[0].blocks[0].sequenceId = 'missing'
    expect(validateContent(b).some((e) => e.includes('unknown sequence "missing"'))).toBe(true)
    b.schedules[0].blocks[0].sequenceId = 'seq-a'
    expect(validateContent(b).some((e) => e.includes('from grade k'))).toBe(true)
  })

  it('does not allow a block to have both a lesson and a sequence', () => {
    const block = { ...schedule.blocks[0], sequenceId: 'seq-a' }
    expect(ScheduleBlockSchema.safeParse(block).success).toBe(false)
  })
})

describe('schemas', () => {
  it('requires a URL source on standards', () => {
    expect(StandardSchema.safeParse({ ...standard, source: 'not a url' }).success).toBe(false)
  })

  it('requires at least one activity per lesson', () => {
    expect(LessonSchema.safeParse({ ...lesson, activities: [] }).success).toBe(false)
  })
})
