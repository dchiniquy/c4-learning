import type { Child, ExportData, NewChild, PinRecord, ProgressRecord, SkillMastery } from './types.ts'

/**
 * Persistence boundary for everything the app remembers about a family.
 * The only implementation today is local (IndexedDB); a synced backend can
 * implement this same interface later without touching the UI.
 */
export interface ProgressStore {
  listChildren(): Promise<Child[]>
  addChild(input: NewChild): Promise<Child>
  updateChild(id: string, patch: Partial<NewChild>): Promise<Child>
  /** Removes the child and all of their progress and mastery records. */
  deleteChild(id: string): Promise<void>

  getProgress(childId: string): Promise<ProgressRecord[]>
  putProgress(record: ProgressRecord): Promise<void>
  getMastery(childId: string): Promise<SkillMastery[]>
  putMastery(record: SkillMastery): Promise<void>

  getPinRecord(): Promise<PinRecord | undefined>
  setPinRecord(record: PinRecord): Promise<void>

  exportAll(): Promise<ExportData>
  /** Replaces all children, progress and mastery. Leaves the PIN untouched. Input must already be validated. */
  importAll(data: ExportData): Promise<void>
}
