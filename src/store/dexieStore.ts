import Dexie, { type EntityTable } from 'dexie'
import type { ProgressStore } from './ProgressStore.ts'
import type { Child, ExportData, NewChild, PinRecord, ProgressRecord, ScheduleCheck, SkillMastery } from './types.ts'

type SettingRow = { key: string; value: unknown }

class C4Database extends Dexie {
  children!: EntityTable<Child, 'id'>
  progress!: Dexie.Table<ProgressRecord, [string, string]>
  mastery!: Dexie.Table<SkillMastery, [string, string]>
  checks!: Dexie.Table<ScheduleCheck, [string, string, string]>
  settings!: EntityTable<SettingRow, 'key'>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      children: 'id',
      progress: '[childId+activityId], childId',
      mastery: '[childId+skillId], childId',
      settings: 'key',
    })
    this.version(2).stores({ checks: '[childId+date+blockKey], [childId+date], childId' })
  }
}

export class DexieProgressStore implements ProgressStore {
  #db: C4Database

  constructor(dbName = 'c4-learning') {
    this.#db = new C4Database(dbName)
  }

  async listChildren() {
    return (await this.#db.children.toArray()).sort((a, b) => a.createdAt - b.createdAt)
  }

  async addChild(input: NewChild) {
    const child: Child = { id: crypto.randomUUID(), createdAt: Date.now(), ...input, name: input.name.trim() }
    await this.#db.children.add(child)
    return child
  }

  async updateChild(id: string, patch: Partial<NewChild>) {
    const existing = await this.#db.children.get(id)
    if (!existing) throw new Error(`No child with id ${id}`)
    const next: Child = { ...existing, ...patch, name: (patch.name ?? existing.name).trim() }
    await this.#db.children.put(next)
    return next
  }

  async deleteChild(id: string) {
    const { children, progress, mastery, checks } = this.#db
    await this.#db.transaction('rw', children, progress, mastery, checks, async () => {
      await children.delete(id)
      await progress.where('childId').equals(id).delete()
      await mastery.where('childId').equals(id).delete()
      await checks.where('childId').equals(id).delete()
    })
  }

  getProgress(childId: string) {
    return this.#db.progress.where('childId').equals(childId).toArray()
  }

  async putProgress(record: ProgressRecord) {
    await this.#db.progress.put(record)
  }

  getMastery(childId: string) {
    return this.#db.mastery.where('childId').equals(childId).toArray()
  }

  async putMastery(record: SkillMastery) {
    await this.#db.mastery.put(record)
  }

  getChecks(childId: string, date: string) {
    return this.#db.checks.where('[childId+date]').equals([childId, date]).toArray()
  }

  listChecks(childId: string) {
    return this.#db.checks.where('childId').equals(childId).toArray()
  }

  async setCheck(record: ScheduleCheck) {
    await this.#db.checks.put(record)
  }

  async removeCheck(childId: string, date: string, blockKey: string) {
    await this.#db.checks.delete([childId, date, blockKey])
  }

  async getPinRecord() {
    return (await this.#db.settings.get('pin'))?.value as PinRecord | undefined
  }

  async setPinRecord(record: PinRecord) {
    await this.#db.settings.put({ key: 'pin', value: record })
  }

  async exportAll(): Promise<ExportData> {
    const [children, progress, mastery, checks] = await Promise.all([
      this.#db.children.toArray(),
      this.#db.progress.toArray(),
      this.#db.mastery.toArray(),
      this.#db.checks.toArray(),
    ])
    return { app: 'c4-learning', version: 1, exportedAt: Date.now(), children, progress, mastery, checks }
  }

  async importAll(data: ExportData) {
    const { children, progress, mastery, checks } = this.#db
    await this.#db.transaction('rw', children, progress, mastery, checks, async () => {
      await Promise.all([children.clear(), progress.clear(), mastery.clear(), checks.clear()])
      await children.bulkAdd(data.children)
      await progress.bulkAdd(data.progress)
      await mastery.bulkAdd(data.mastery)
      await checks.bulkAdd(data.checks)
    })
  }
}
