import { describe, expect, it } from 'vitest'
import { loadContentBundle } from './load.ts'

describe('loadContentBundle', () => {
  it('loads and validates the real content shipped in content/', () => {
    const bundle = loadContentBundle()
    expect(bundle.standards.length).toBeGreaterThan(0)
    expect(bundle.schedules.map((s) => s.grade).sort()).toEqual(['1', 'prek'])
    expect(bundle.standards.every((s) => s.verified)).toBe(true)
  })

  it('throws a readable error listing every problem', () => {
    const modules = {
      '../../content/standards/x.json': [{ id: 'bad id', framework: 'ccss-math' }],
      '../../content/skills/y.json': { id: 's1', subject: 'math', name: 'S', standardIds: ['missing'] },
    }
    expect(() => loadContentBundle(modules)).toThrowError(/Invalid content:[\s\S]*standards\/x\.json[\s\S]*unknown standard "missing"/)
  })

  it('accepts an empty content tree', () => {
    expect(loadContentBundle({})).toEqual({ standards: [], skills: [], lessons: [], sequences: [], schedules: [] })
  })
})
