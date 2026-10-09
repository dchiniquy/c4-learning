import { describe, expect, it } from 'vitest'
import type { Lesson, ScheduleTemplate } from '../content/schema.ts'
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
    const plan = planDay({ lessons: [lesson] }, template, 1, new Set())
    expect(plan.items.map((i) => i.block.label)).toEqual(['Early', 'Late app', 'Later app'])
    expect(plan.items[0].lesson?.id).toBe('lesson-a')
    expect(plan.items[1].lesson).toBeUndefined()
    expect(plan.items[0].end).toBe('09:15')
  })

  it('totals screen time and counts only completed screen blocks', () => {
    const done = new Set([blockKey(template, template.blocks[0]), blockKey(template, template.blocks[1])])
    const { screen, items } = planDay({ lessons: [lesson] }, template, 1, done)
    expect(screen).toEqual({ planned: 30, completed: 20, budget: 40 })
    expect(items.map((i) => i.done)).toEqual([true, true, false])
  })

  it('is empty on days with no blocks', () => {
    const plan = planDay({ lessons: [] }, template, 6, new Set())
    expect(plan.items).toEqual([])
    expect(plan.screen.planned).toBe(0)
  })

  it('keys blocks by template, day and start time', () => {
    expect(blockKey(template, template.blocks[1])).toBe('t1:1:09:00')
  })
})

describe('templateForGrade', () => {
  it('finds the template for a grade', () => {
    expect(templateForGrade([template], 'k')?.id).toBe('t1')
    expect(templateForGrade([template], '3')).toBeUndefined()
  })
})
