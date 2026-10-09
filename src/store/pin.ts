import type { PinRecord } from './types.ts'

export const PIN_PATTERN = /^\d{4,6}$/
const ITERATIONS = 100_000

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return toBase64(new Uint8Array(bits))
}

export async function hashPin(pin: string): Promise<PinRecord> {
  if (!PIN_PATTERN.test(pin)) throw new Error('PIN must be 4 to 6 digits')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { salt: toBase64(salt), hash: await derive(pin, salt, ITERATIONS), iterations: ITERATIONS }
}

export async function verifyPin(pin: string, record: PinRecord): Promise<boolean> {
  const hash = await derive(pin, fromBase64(record.salt) as Uint8Array<ArrayBuffer>, record.iterations)
  return hash === record.hash
}
