import { describe, expect, it } from 'vitest'
import { newStores } from '../test/helpers.ts'
import { ExportDataSchema, type ProgressRecord } from './types.ts'

const progressFor = (childId: string, activityId = 'act-1'): ProgressRecord => ({
  childId, activityId, lessonId: 'lesson-1', lessonVersion: 1, status: 'done', attempts: 1, timeSpentSec: 60, updatedAt: 1,
})

describe('DexieProgressStore', () => {
  it('adds, lists, updates children in creation order', async () => {
    const { progress } = newStores()
    const a = await progress.addChild({ name: ' Ada ', avatar: '🦊', grade: 'prek' })
    const b = await progress.addChild({ name: 'Bo', avatar: '🐼', grade: '2' })
    expect(a.name).toBe('Ada')
    expect((await progress.listChildren()).map((c) => c.id)).toEqual([a.id, b.id])

    const updated = await progress.updateChild(a.id, { grade: 'k' })
    expect(updated).toMatchObject({ name: 'Ada', grade: 'k' })
    await expect(progress.updateChild('missing', { name: 'x' })).rejects.toThrow()
  })

  it('upserts progress and mastery per child', async () => {
    const { progress } = newStores()
    const a = await progress.addChild({ name: 'Ada', avatar: '🦊', grade: 'k' })
    await progress.putProgress(progressFor(a.id))
    await progress.putProgress({ ...progressFor(a.id), attempts: 2 })
    await progress.putMastery({ childId: a.id, skillId: 'skill-1', level: 'practicing' })
    expect(await progress.getProgress(a.id)).toHaveLength(1)
    expect((await progress.getProgress(a.id))[0].attempts).toBe(2)
    expect(await progress.getMastery(a.id)).toHaveLength(1)
  })

  it("deleting a child removes only that child's records", async () => {
    const { progress } = newStores()
    const a = await progress.addChild({ name: 'Ada', avatar: '🦊', grade: 'k' })
    const b = await progress.addChild({ name: 'Bo', avatar: '🐼', grade: '1' })
    for (const c of [a, b]) {
      await progress.putProgress(progressFor(c.id))
      await progress.putMastery({ childId: c.id, skillId: 's', level: 'mastered' })
    }
    await progress.deleteChild(a.id)
    expect(await progress.getProgress(a.id)).toEqual([])
    expect(await progress.getMastery(a.id)).toEqual([])
    expect(await progress.getProgress(b.id)).toHaveLength(1)
    expect((await progress.listChildren()).map((c) => c.id)).toEqual([b.id])
  })

  it('round-trips through export/import and replaces existing data, keeping the PIN', async () => {
    const src = newStores().progress
    const a = await src.addChild({ name: 'Ada', avatar: '🦊', grade: 'k' })
    await src.putProgress(progressFor(a.id))
    const exported = await src.exportAll()
    expect(ExportDataSchema.safeParse(exported).success).toBe(true)
    expect(JSON.stringify(exported)).not.toContain('salt')

    const dest = newStores().progress
    await dest.setPinRecord({ salt: 's', hash: 'h', iterations: 1 })
    await dest.addChild({ name: 'Old', avatar: '🐸', grade: '3' })
    await dest.importAll(exported)
    expect((await dest.listChildren()).map((c) => c.name)).toEqual(['Ada'])
    expect(await dest.getProgress(a.id)).toHaveLength(1)
    expect(await dest.getPinRecord()).toEqual({ salt: 's', hash: 'h', iterations: 1 })
  })

  it('records, lists, and removes schedule check-offs per child and date', async () => {
    const { progress } = newStores()
    const a = await progress.addChild({ name: 'Ada', avatar: '🦊', grade: 'k' })
    const check = (date: string, blockKey: string) => ({ childId: a.id, date, blockKey, completedAt: 1 })
    await progress.setCheck(check('2026-10-12', 't:1:09:00'))
    await progress.setCheck(check('2026-10-12', 't:1:09:00')) // idempotent
    await progress.setCheck(check('2026-10-12', 't:1:10:00'))
    await progress.setCheck(check('2026-10-13', 't:2:09:00'))
    expect((await progress.getChecks(a.id, '2026-10-12')).map((c) => c.blockKey).sort()).toEqual(['t:1:09:00', 't:1:10:00'])
    await progress.removeCheck(a.id, '2026-10-12', 't:1:09:00')
    expect(await progress.getChecks(a.id, '2026-10-12')).toHaveLength(1)
    expect(await progress.getChecks(a.id, '2026-10-13')).toHaveLength(1)
  })

  it('deleting a child removes their check-offs, and checks survive export/import', async () => {
    const src = newStores().progress
    const a = await src.addChild({ name: 'Ada', avatar: '🦊', grade: 'k' })
    const b = await src.addChild({ name: 'Bo', avatar: '🐼', grade: '1' })
    await src.setCheck({ childId: a.id, date: '2026-10-12', blockKey: 'k', completedAt: 1 })
    await src.setCheck({ childId: b.id, date: '2026-10-12', blockKey: 'k', completedAt: 1 })
    const exported = await src.exportAll()
    expect(exported.checks).toHaveLength(2)

    const dest = newStores().progress
    await dest.importAll(exported)
    expect(await dest.getChecks(b.id, '2026-10-12')).toHaveLength(1)

    await src.deleteChild(a.id)
    expect(await src.getChecks(a.id, '2026-10-12')).toEqual([])
    expect(await src.getChecks(b.id, '2026-10-12')).toHaveLength(1)
  })

  it('stores the pin record', async () => {
    const { progress } = newStores()
    expect(await progress.getPinRecord()).toBeUndefined()
    await progress.setPinRecord({ salt: 'a', hash: 'b', iterations: 3 })
    expect(await progress.getPinRecord()).toEqual({ salt: 'a', hash: 'b', iterations: 3 })
  })
})
