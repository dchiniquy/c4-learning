import { describe, expect, it } from 'vitest'
import { renderReviewHtml } from './review.ts'
import type { ContentBundle, Lesson } from './schema.ts'

const std = (id: string, code: string, description: string) =>
  ({ id, framework: 'tx-prek', code, description, grade: 'prek', source: 'https://example.com/s', verified: true }) as const

const lesson = (id: string, week: number | undefined, subject: Lesson['subject'], title: string, skillIds: string[]): Lesson => ({
  id, grade: 'prek', subject, unit: 'u1', week, title, version: 1, skillIds,
  activities: [{ id: `${id}-a`, type: 'offline-task', mode: 'offline', leadBy: 'parent', title: `${title} activity`, minutes: 15, materials: ['paper & glue'], parentPrompts: ['Say "hi" <loudly>'], payload: {} }],
})

const bundle: ContentBundle = {
  standards: [std('s1', 'PK4.V.A.2', 'Counts up to 10 objects'), std('s2', 'PK4.III.B.6', 'Identifies rhyming words')],
  skills: [
    { id: 'k1', subject: 'math', name: 'Counting', prerequisites: [], standardIds: ['s1'] },
    { id: 'k2', subject: 'literacy', name: 'Rhyming', prerequisites: [], standardIds: ['s2'] },
    { id: 'k3', subject: 'arts', name: 'Making art', prerequisites: [], standardIds: [] },
  ],
  lessons: [
    lesson('b2', 2, 'math', 'Second math', ['k1']),
    lesson('b1', 1, 'math', 'First math', ['k1']),
    lesson('l1', 1, 'literacy', 'Rhyme time', ['k2']),
    lesson('a1', 1, 'arts', 'Paint & play', ['k3']),
    { ...lesson('other', 1, 'math', 'Other unit', ['k1']), unit: 'u2' },
  ],
  sequences: [{ id: 'seq', grade: 'prek', subject: 'math', name: 'Math', lessonIds: ['b1', 'b2'] }],
  schedules: [],
}

const html = renderReviewHtml(bundle, { grade: 'prek', unit: 'u1', title: 'Pre-K <Unit 1>' })

describe('renderReviewHtml', () => {
  it('includes only the requested unit, grouped by week and in sequence order', () => {
    expect(html).not.toContain('Other unit')
    expect(html.indexOf('Week 1')).toBeLessThan(html.indexOf('Week 2'))
    expect(html.indexOf('First math')).toBeLessThan(html.indexOf('Second math'))
    expect(html).toContain('4 lessons across 2 weeks')
  })

  it('escapes content so lesson text cannot inject markup', () => {
    expect(html).toContain('Pre-K &lt;Unit 1&gt;')
    expect(html).toContain('Paint &amp; play')
    expect(html).toContain('Say &quot;hi&quot; &lt;loudly&gt;')
    expect(html).not.toContain('<loudly>')
  })

  it('shows each lesson\'s standards, and flags lessons with none', () => {
    expect(html).toContain('PK4.V.A.2')
    expect(html).toContain('<em>none linked</em>') // the art lesson
  })

  it('ends with a coverage table counting lessons per standard', () => {
    const table = html.slice(html.indexOf('Standards covered'))
    expect(table).toMatch(/PK4\.V\.A\.2<\/td><td>Counts up to 10 objects<\/td><td>2<\/td>/)
    expect(table).toMatch(/PK4\.III\.B\.6<\/td><td>Identifies rhyming words<\/td><td>1<\/td>/)
  })

  it('handles a unit with no lessons', () => {
    expect(renderReviewHtml(bundle, { grade: 'k', unit: 'none', title: 'Empty' })).toContain('0 lessons across 0 weeks')
  })
})
