import Dexie, { type EntityTable } from 'dexie'
import type { ProgressStore } from './ProgressStore.ts'
import type { Child, ExportData, NewChild, PinRecord, ProgressRecord, SkillMastery } from './types.ts'

type SettingRow = { key: string; value: unknown }

class C4Database extends Dexie {
  children!: EntityTable<Child, 'id'>
  progress!: Dexie.Table<ProgressRecord, [string, string]>
  mastery!: Dexie.Table<SkillMastery, [string, string]>
  settings!: EntityTable<SettingRow, 'key'>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      children: 'id',
      progress: '[childId+activityId], childId',
      mastery: '[childId+skillId], childId',
      settings: 'key',
    })
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
    await this.#db.transaction('rw', this.#db.children, this.#db.progress, this.#db.mastery, async () => {
      await this.#db.children.delete(id)
      await this.#db.progress.where('childId').equals(id).delete()
      await this.#db.mastery.where('childId').equals(id).delete()
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

  async getPinRecord() {
    return (await this.#db.settings.get('pin'))?.value as PinRecord | undefined
  }

  async setPinRecord(record: PinRecord) {
    await this.#db.settings.put({ key: 'pin', value: record })
  }

  async exportAll(): Promise<ExportData> {
    const [children, progress, mastery] = await Promise.all([
      this.#db.children.toArray(),
      this.#db.progress.toArray(),
      this.#db.mastery.toArray(),
    ])
    return { app: 'c4-learning', version: 1, exportedAt: Date.now(), children, progress, mastery }
  }

  async importAll(data: ExportData) {
    await this.#db.transaction('rw', this.#db.children, this.#db.progress, this.#db.mastery, async () => {
      await Promise.all([this.#db.children.clear(), this.#db.progress.clear(), this.#db.mastery.clear()])
      await this.#db.children.bulkAdd(data.children)
      await this.#db.progress.bulkAdd(data.progress)
      await this.#db.mastery.bulkAdd(data.mastery)
    })
  }
}
