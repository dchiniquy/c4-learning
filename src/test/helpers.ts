import { createAppStore } from '../store/appStore.ts'
import { DexieProgressStore } from '../store/dexieStore.ts'

let n = 0

/** A fresh in-memory-backed store pair (fake-indexeddb), isolated per call. */
export function newStores() {
  const progress = new DexieProgressStore(`test-db-${++n}-${Math.random()}`)
  return { progress, app: createAppStore(progress) }
}
