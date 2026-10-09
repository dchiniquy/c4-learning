import { describe, expect, it } from 'vitest'
import { hashPin, verifyPin } from './pin.ts'

describe('pin', () => {
  it('verifies the right PIN and rejects a wrong one', async () => {
    const record = await hashPin('1234')
    expect(await verifyPin('1234', record)).toBe(true)
    expect(await verifyPin('1235', record)).toBe(false)
  })

  it('does not store the PIN and uses a fresh salt each time', async () => {
    const a = await hashPin('1234')
    const b = await hashPin('1234')
    expect(JSON.stringify(a)).not.toContain('1234')
    expect(a.salt).not.toBe(b.salt)
    expect(a.hash).not.toBe(b.hash)
  })

  it('rejects malformed PINs', async () => {
    for (const bad of ['', '123', '1234567', 'abcd', '12 34']) {
      await expect(hashPin(bad)).rejects.toThrow()
    }
  })
})
