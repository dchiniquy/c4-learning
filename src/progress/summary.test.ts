import { describe, expect, it } from 'vitest'
import { fixtureContent } from '../test/fixtures.ts'
import type { ScheduleCheck } from '../store/types.ts'
import { summarizeProgress } from './summary.ts'

const content = fixtureContent()
const check = (date: string, lessonId?: string, blockKey = `${date}:${lessonId}`): ScheduleCheck => ({ childId: 'c', date, blockKey, completedAt: 1, ...(lessonId ? { lessonId } : {}) })
const run = (checks: ScheduleCheck[], marks: Parameters<typeof summarizeProgress>[3] = [], today = '2026-10-12') =>
  summarizeProgress(content, 'k', checks, marks, today)
const skill = (s: ReturnType<typeof run>, id: string) => s.bySubject.flatMap((x) => x.skills).find((x) => x.skill.id === id)!

describe('summarizeProgress', () => {
  it('starts everything at not started', () => {
    const s = run([])
    expect(s).toMatchObject({ lessonsDone: 0, lessonsTotal: 4, daysActive: 0, standardsWorkedOn: 0, standardsAvailable: 2, recent: [] })
    expect(skill(s, 'sk-count')).toMatchObject({ level: 'not-started', lessonsDone: 0, lessonsTotal: 2, marked: false })
  })

  it('only counts lessons at the child\'s level', () => {
    const s = run([check('2026-10-12', 'g1')])
    expect(s.lessonsDone).toBe(0)
    expect(s.bySubject.flatMap((x) => x.skills).some((x) => x.skill.id === 'sk-g1')).toBe(false)
  })

  it('counts each lesson once and works out Practicing from lessons done', () => {
    const s = run([check('2026-10-10', 'c1'), check('2026-10-11', 'c1', 'other-block'), check('2026-10-12', 'a1')])
    expect(s.lessonsDone).toBe(2)
    expect(skill(s, 'sk-count')).toMatchObject({ lessonsDone: 1, level: 'practicing' })
    expect(skill(s, 'sk-read')).toMatchObject({ lessonsDone: 0, level: 'not-started' })
    expect(s.standardsWorkedOn).toBe(2)
  })

  it('lets a parent\'s mark override the worked-out level', () => {
    const s = run([check('2026-10-12', 'c1')], [{ childId: 'c', skillId: 'sk-count', level: 'mastered' }, { childId: 'c', skillId: 'sk-read', level: 'proficient' }])
    expect(skill(s, 'sk-count')).toMatchObject({ level: 'mastered', marked: true })
    expect(skill(s, 'sk-read')).toMatchObject({ level: 'proficient', marked: true, lessonsDone: 0 })
  })

  it('ignores unknown lesson ids and checks without a lesson, but still counts the day', () => {
    const s = run([check('2026-10-12', 'ghost'), check('2026-10-11')])
    expect(s.lessonsDone).toBe(0)
    expect(s.daysActive).toBe(2)
  })

  it('groups by subject with lesson totals', () => {
    const s = run([check('2026-10-12', 'r1')])
    expect(s.bySubject.map((x) => [x.subject, x.lessonsDone, x.lessonsTotal])).toEqual([['literacy', 1, 1], ['math', 0, 3]])
  })

  it('lists the last 7 days newest first, including today and 6 days back but nothing older or in the future', () => {
    const s = run([
      check('2026-10-12', 'c1'), check('2026-10-06', 'c2'), check('2026-10-05', 'a1'), check('2026-10-13', 'r1'),
    ])
    expect(s.recent.map((r) => [r.date, r.lesson.id])).toEqual([['2026-10-12', 'c1'], ['2026-10-06', 'c2']])
  })
})
