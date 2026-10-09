import { describe, expect, it } from 'vitest'
import { backupFilename, parseBackup } from './backup.ts'

const child = { id: 'c1', name: 'Ada', avatar: '🦊', grade: 'k', createdAt: 1 }
const base = { app: 'c4-learning', version: 1, exportedAt: 1, children: [child], progress: [], mastery: [] }

describe('parseBackup', () => {
  it('accepts a valid backup', () => {
    expect(parseBackup(JSON.stringify(base))).toMatchObject({ ok: true })
  })

  it('rejects invalid JSON and wrong shapes without throwing', () => {
    expect(parseBackup('{nope')).toMatchObject({ ok: false })
    expect(parseBackup('{"hello":1}')).toMatchObject({ ok: false })
    expect(parseBackup(JSON.stringify({ ...base, version: 2 }))).toMatchObject({ ok: false })
  })

  it('rejects duplicate children and orphaned records', () => {
    expect(parseBackup(JSON.stringify({ ...base, children: [child, child] }))).toMatchObject({ ok: false })
    const orphan = { childId: 'ghost', skillId: 's', level: 'mastered' }
    expect(parseBackup(JSON.stringify({ ...base, mastery: [orphan] }))).toMatchObject({ ok: false })
  })
})

describe('backupFilename', () => {
  it('includes the date', () => {
    expect(backupFilename(new Date('2026-10-09T12:00:00Z'))).toBe('c4-learning-backup-2026-10-09.json')
  })
})
