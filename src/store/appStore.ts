import { createContext, useContext } from 'react'
import { create, useStore, type StoreApi } from 'zustand'
import type { ProgressStore } from './ProgressStore.ts'
import { hashPin, verifyPin } from './pin.ts'
import type { Child, ExportData, NewChild, PinRecord } from './types.ts'

export const MAX_PIN_ATTEMPTS = 5
export const LOCKOUT_MS = 30_000

export type UnlockResult = 'ok' | 'wrong' | 'locked'

export type AppState = {
  ready: boolean
  children: Child[]
  pin: PinRecord | undefined
  /** Session-only: never persisted, cleared on reload or when a child profile is opened. */
  parentUnlocked: boolean
  failedAttempts: number
  lockedUntil: number

  load(): Promise<void>
  setupPin(pin: string): Promise<void>
  unlock(pin: string): Promise<UnlockResult>
  lock(): void
  addChild(input: NewChild): Promise<Child>
  updateChild(id: string, patch: Partial<NewChild>): Promise<void>
  deleteChild(id: string): Promise<void>
  exportData(): Promise<ExportData>
  importData(data: ExportData): Promise<void>
}

export function createAppStore(progress: ProgressStore) {
  return create<AppState>((set, get) => ({
    ready: false,
    children: [],
    pin: undefined,
    parentUnlocked: false,
    failedAttempts: 0,
    lockedUntil: 0,

    async load() {
      const [children, pin] = await Promise.all([progress.listChildren(), progress.getPinRecord()])
      set({ children, pin, ready: true })
    },

    async setupPin(pin) {
      if (get().pin) throw new Error('A PIN is already set')
      const record = await hashPin(pin)
      await progress.setPinRecord(record)
      set({ pin: record, parentUnlocked: true })
    },

    async unlock(pin) {
      const { pin: record, lockedUntil } = get()
      if (!record) return 'wrong'
      if (Date.now() < lockedUntil) return 'locked'
      if (await verifyPin(pin, record)) {
        set({ parentUnlocked: true, failedAttempts: 0, lockedUntil: 0 })
        return 'ok'
      }
      const failedAttempts = get().failedAttempts + 1
      if (failedAttempts >= MAX_PIN_ATTEMPTS) {
        set({ failedAttempts: 0, lockedUntil: Date.now() + LOCKOUT_MS })
        return 'locked'
      }
      set({ failedAttempts })
      return 'wrong'
    },

    lock() {
      set({ parentUnlocked: false })
    },

    async addChild(input) {
      const child = await progress.addChild(input)
      set({ children: await progress.listChildren() })
      return child
    },

    async updateChild(id, patch) {
      await progress.updateChild(id, patch)
      set({ children: await progress.listChildren() })
    },

    async deleteChild(id) {
      await progress.deleteChild(id)
      set({ children: await progress.listChildren() })
    },

    exportData: () => progress.exportAll(),

    async importData(data) {
      await progress.importAll(data)
      set({ children: await progress.listChildren() })
    },
  }))
}

export type AppStore = StoreApi<AppState>

export const AppStoreContext = createContext<AppStore | null>(null)

export function useApp<T>(selector: (state: AppState) => T): T {
  const store = useContext(AppStoreContext)
  if (!store) throw new Error('useApp must be used inside <AppStoreContext.Provider>')
  return useStore(store, selector)
}

export function useAppStore(): AppStore {
  const store = useContext(AppStoreContext)
  if (!store) throw new Error('useAppStore must be used inside <AppStoreContext.Provider>')
  return store
}
