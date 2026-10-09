import { describe, expect, it } from 'vitest'
import { forGrade } from './grade.ts'
import { GRADES } from './schema.ts'
import { eagerSource } from './source.ts'
import { fixtureContent } from '../test/fixtures.ts'

describe('shipped content', () => {
  it('loads, validates, and has only verified standards', async () => {
    const { default: bundle } = await import('virtual:c4-content/all')
    expect(bundle.standards.length).toBeGreaterThan(0)
    expect(bundle.standards.every((s) => s.verified)).toBe(true)
    expect(bundle.schedules.map((s) => s.grade)).toEqual(expect.arrayContaining(['prek', '1']))
  })

  it('splits cleanly by grade with no lessons lost or duplicated', async () => {
    const { default: bundle } = await import('virtual:c4-content/all')
    const slices = GRADES.map((g) => forGrade(bundle, g))
    expect(slices.reduce((n, s) => n + s.lessons.length, 0)).toBe(bundle.lessons.length)
    expect(slices.reduce((n, s) => n + s.sequences.length, 0)).toBe(bundle.sequences.length)
    expect(slices.reduce((n, s) => n + s.schedules.length, 0)).toBe(bundle.schedules.length)
  })

  it('serves each grade module with the skills its lessons use', async () => {
    const prek = (await import('virtual:c4-content/grade-prek')).default
    expect(prek.lessons.length).toBeGreaterThan(0)
    expect(prek.lessons.every((l) => l.grade === 'prek')).toBe(true)
    const skillIds = new Set(prek.skills.map((s) => s.id))
    expect(prek.lessons.every((l) => l.skillIds.every((id) => skillIds.has(id)))).toBe(true)
  })

  it('keeps standards out of the grade modules', async () => {
    const prek = (await import('virtual:c4-content/grade-prek')).default
    expect('standards' in prek).toBe(false)
    expect((await import('virtual:c4-content/standards')).default.length).toBeGreaterThan(100)
  })
})

describe('forGrade / eagerSource', () => {
  const bundle = fixtureContent()

  it('keeps only that grade, and only the skills its lessons use', () => {
    const k = forGrade(bundle, 'k')
    expect(k.lessons.map((l) => l.id)).toEqual(['c1', 'c2', 'a1', 'r1'])
    expect(k.skills.map((s) => s.id).sort()).toEqual(['sk-add', 'sk-count', 'sk-read'])
    expect(forGrade(bundle, '1').skills.map((s) => s.id)).toEqual(['sk-g1'])
    expect(forGrade(bundle, '3')).toEqual({ lessons: [], skills: [], sequences: [], schedules: [] })
  })

  it('serves a grade and the standards from memory', async () => {
    const source = eagerSource(bundle)
    expect((await source.loadGrade('1')).lessons).toHaveLength(1)
    expect(await source.loadStandards()).toBe(bundle.standards)
  })
})
