import { describe, expect, it } from 'vitest'
import type { Lesson, ScheduleTemplate, Sequence } from '../content/schema.ts'
import type { ScheduleCheck } from '../store/types.ts'
import { blockKey, endTime, formatTime, isoWeekday, localDateString, planDay, templateForGrade } from './engine.ts'

const lesson = {
  id: 'lesson-a', grade: 'k', subject: 'math', unit: 'u1', title: 'L', version: 1, skillIds: ['s'],
  activities: [{ id: 'a', type: 'offline-task', mode: 'offline', leadBy: 'parent', title: 'A', minutes: 5, materials: [], parentPrompts: [], payload: {} }],
} as Lesson

const template: ScheduleTemplate = {
  id: 't1', grade: 'k', name: 'T',
  blocks: [
    { day: 1, start: '10:00', minutes: 20, subject: 'math', mode: 'screen', leadBy: 'app', label: 'Late app' },
    { day: 1, start: '09:00', minutes: 15, subject: 'math', mode: 'offline', leadBy: 'parent', label: 'Early', lessonId: 'lesson-a' },
    { day: 1, start: '11:00', minutes: 10, subject: 'literacy', mode: 'screen', leadBy: 'app', label: 'Later app' },
    { day: 2, start: '09:00', minutes: 10, subject: 'math', mode: 'offline', leadBy: 'parent', label: 'Tuesday' },
  ],
}

const DATE = '2026-10-12'
const check = (key: string, date: string, lessonId?: string): ScheduleCheck => ({ childId: 'c', date, blockKey: key, completedAt: 1, ...(lessonId ? { lessonId } : {}) })

describe('date helpers', () => {
  it('maps JS weekdays to ISO (Monday = 1, Sunday = 7)', () => {
    expect(isoWeekday(new Date(2026, 9, 12))).toBe(1) // Mon
    expect(isoWeekday(new Date(2026, 9, 9))).toBe(5) // Fri
    expect(isoWeekday(new Date(2026, 9, 11))).toBe(7) // Sun
  })

  it('formats the local date, not UTC', () => {
    expect(localDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(localDateString(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31')
  })

  it('computes end and 12-hour times', () => {
    expect(endTime(template.blocks[0])).toBe('10:20')
    expect(endTime({ ...template.blocks[0], start: '09:50', minutes: 20 })).toBe('10:10')
    expect(formatTime('00:05')).toBe('12:05 AM')
    expect(formatTime('12:00')).toBe('12:00 PM')
    expect(formatTime('13:05')).toBe('1:05 PM')
  })
})

describe('planDay', () => {
  it('returns only that weekday, in time order, with lessons attached', () => {
    const plan = planDay({ lessons: [lesson] }, template, 1, [], DATE)
    expect(plan.items.map((i) => i.block.label)).toEqual(['Early', 'Late app', 'Later app'])
    expect(plan.items[0].lesson?.id).toBe('lesson-a')
    expect(plan.items[1].lesson).toBeUndefined()
    expect(plan.items[0].end).toBe('09:15')
  })

  it('totals screen time and counts only completed screen blocks', () => {
    const done = [template.blocks[0], template.blocks[1]].map((b) => check(blockKey(template, b), DATE))
    const { screen, items } = planDay({ lessons: [lesson] }, template, 1, done, DATE)
    expect(screen).toEqual({ planned: 30, completed: 20, budget: 40 })
    expect(items.map((i) => i.done)).toEqual([true, true, false])
  })

  it('is empty on days with no blocks', () => {
    const plan = planDay({ lessons: [] }, template, 6, [], DATE)
    expect(plan.items).toEqual([])
    expect(plan.screen.planned).toBe(0)
  })

  it('keys blocks by template, day and start time', () => {
    expect(blockKey(template, template.blocks[1])).toBe('t1:1:09:00')
  })
})

describe('planDay with sequences', () => {
  const mk = (id: string) => ({ ...lesson, id, title: id }) as Lesson
  const lessons = [mk('l1'), mk('l2'), mk('l3')]
  const seq: Sequence = { id: 'seq', grade: 'k', subject: 'math', name: 'S', lessonIds: ['l1', 'l2', 'l3'] }
  const seqTemplate: ScheduleTemplate = {
    id: 'st', grade: 'k', name: 'ST',
    blocks: [
      { day: 1, start: '09:00', minutes: 15, subject: 'math', mode: 'offline', leadBy: 'parent', label: 'A', sequenceId: 'seq' },
      { day: 1, start: '10:00', minutes: 15, subject: 'math', mode: 'offline', leadBy: 'parent', label: 'B', sequenceId: 'seq' },
      { day: 2, start: '09:00', minutes: 15, subject: 'math', mode: 'offline', leadBy: 'parent', label: 'A2', sequenceId: 'seq' },
    ],
  }
  const A = blockKey(seqTemplate, seqTemplate.blocks[0])
  const B = blockKey(seqTemplate, seqTemplate.blocks[1])
  const run = (checks: ScheduleCheck[], day = 1, date = DATE) => planDay({ lessons, sequences: [seq] }, seqTemplate, day, checks, date).items

  it('starts at the first lesson and gives later blocks the following ones', () => {
    expect(run([]).map((i) => i.lesson?.id)).toEqual(['l1', 'l2'])
  })

  it('skips lessons finished on earlier days, however many days ago', () => {
    expect(run([check(A, '2026-10-01', 'l1'), check(B, '2026-10-02', 'l2')]).map((i) => i.lesson?.id)).toEqual(['l3', undefined])
  })

  it("keeps showing today's ticked lesson instead of advancing past it", () => {
    const items = run([check(A, DATE, 'l1')])
    expect(items.map((i) => [i.lesson?.id, i.done])).toEqual([['l1', true], ['l2', false]])
  })

  it('does not hand the same lesson to two blocks even when the later one is ticked first', () => {
    const items = run([check(B, DATE, 'l1')])
    expect(items.map((i) => i.lesson?.id)).toEqual(['l2', 'l1'])
  })

  it('un-ticking returns a lesson to the pool', () => {
    expect(run([]).map((i) => i.lesson?.id)).toEqual(['l1', 'l2'])
  })

  it('marks a block as finished when no lessons remain', () => {
    const all = ['l1', 'l2', 'l3'].map((id) => check(`x:${id}`, '2026-10-01', id))
    const items = run(all, 2, '2026-10-13')
    expect(items[0]).toMatchObject({ lesson: undefined, sequenceFinished: true })
  })

  it('ignores checks without a lesson id when working out progress', () => {
    expect(run([check(A, '2026-10-01')]).map((i) => i.lesson?.id)).toEqual(['l1', 'l2'])
  })
})

describe('templateForGrade', () => {
  it('finds the template for a grade', () => {
    expect(templateForGrade([template], 'k')?.id).toBe('t1')
    expect(templateForGrade([template], '3')).toBeUndefined()
  })
})
