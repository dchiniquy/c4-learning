import type { ContentBundle, Lesson } from '../content/schema.ts'

/** A tiny, fixed content bundle for tests that should not depend on the real curriculum. */
export const std = (id: string, code: string, grade: 'k' | '1' = 'k') =>
  ({ id, framework: 'ccss-math', code, description: `Wording of ${code}`, grade, source: 'https://example.com/s', verified: true }) as const

export const lesson = (id: string, subject: Lesson['subject'], skillIds: string[], grade: Lesson['grade'] = 'k'): Lesson => ({
  id, grade, subject, unit: 'u1', week: 1, title: `Lesson ${id}`, version: 1, skillIds,
  activities: [{ id: `${id}-a`, type: 'offline-task', mode: 'offline', leadBy: 'parent', title: `Do ${id}`, minutes: 10, materials: [], parentPrompts: [], payload: {} }],
})

export const fixtureContent = (): ContentBundle => ({
  standards: [std('s-count', 'K.CC.A.1'), std('s-add', 'K.OA.A.1'), std('s-other', '1.OA.A.1', '1')],
  skills: [
    { id: 'sk-count', subject: 'math', name: 'Counting', prerequisites: [], standardIds: ['s-count'] },
    { id: 'sk-add', subject: 'math', name: 'Adding', prerequisites: [], standardIds: ['s-add'] },
    { id: 'sk-read', subject: 'literacy', name: 'Reading words', prerequisites: [], standardIds: [] },
    { id: 'sk-g1', subject: 'math', name: 'Grade 1 skill', prerequisites: [], standardIds: ['s-other'] },
  ],
  lessons: [
    lesson('c1', 'math', ['sk-count']),
    lesson('c2', 'math', ['sk-count']),
    lesson('a1', 'math', ['sk-add']),
    lesson('r1', 'literacy', ['sk-read']),
    lesson('g1', 'math', ['sk-g1'], '1'),
  ],
  sequences: [],
  schedules: [],
})
