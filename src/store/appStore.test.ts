import { afterEach, describe, expect, it, vi } from 'vitest'
import { newStores } from '../test/helpers.ts'
import { LOCKOUT_MS, MAX_PIN_ATTEMPTS } from './appStore.ts'

afterEach(() => vi.useRealTimers())

async function withPin(pin = '1234') {
  const { app, progress } = newStores()
  await app.getState().load()
  await app.getState().setupPin(pin)
  app.getState().lock()
  return { app, progress }
}

describe('app store', () => {
  it('loads empty state', async () => {
    const { app } = newStores()
    expect(app.getState().ready).toBe(false)
    await app.getState().load()
    expect(app.getState()).toMatchObject({ ready: true, children: [], pin: undefined, parentUnlocked: false })
  })

  it('setupPin unlocks, persists, and cannot be repeated', async () => {
    const { app, progress } = newStores()
    await app.getState().load()
    await app.getState().setupPin('1234')
    expect(app.getState().parentUnlocked).toBe(true)
    expect(await progress.getPinRecord()).toBeDefined()
    await expect(app.getState().setupPin('9999')).rejects.toThrow()
  })

  it('unlock accepts the right PIN and rejects the wrong one', async () => {
    const { app } = await withPin()
    expect(await app.getState().unlock('0000')).toBe('wrong')
    expect(app.getState().parentUnlocked).toBe(false)
    expect(await app.getState().unlock('1234')).toBe('ok')
    expect(app.getState().parentUnlocked).toBe(true)
  })

  it('locks out after too many wrong tries, then allows again', async () => {
    const { app } = await withPin()
    vi.useFakeTimers({ toFake: ['Date'] })
    for (let i = 0; i < MAX_PIN_ATTEMPTS - 1; i++) expect(await app.getState().unlock('0000')).toBe('wrong')
    expect(await app.getState().unlock('0000')).toBe('locked')
    expect(await app.getState().unlock('1234')).toBe('locked') // even the right PIN
    vi.setSystemTime(Date.now() + LOCKOUT_MS + 1)
    expect(await app.getState().unlock('1234')).toBe('ok')
  })

  it('a correct PIN resets the failure counter', async () => {
    const { app } = await withPin()
    for (let i = 0; i < MAX_PIN_ATTEMPTS - 1; i++) await app.getState().unlock('0000')
    expect(await app.getState().unlock('1234')).toBe('ok')
    app.getState().lock()
    for (let i = 0; i < MAX_PIN_ATTEMPTS - 1; i++) expect(await app.getState().unlock('0000')).toBe('wrong')
  })

  it('keeps the children list in sync with the store', async () => {
    const { app } = newStores()
    await app.getState().load()
    const c = await app.getState().addChild({ name: 'Ada', avatar: '🦊', grade: 'prek' })
    await app.getState().updateChild(c.id, { name: 'Ada B' })
    expect(app.getState().children.map((x) => x.name)).toEqual(['Ada B'])
    await app.getState().deleteChild(c.id)
    expect(app.getState().children).toEqual([])
  })
})
