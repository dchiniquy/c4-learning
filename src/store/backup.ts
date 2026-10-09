import { ExportDataSchema, type ExportData } from './types.ts'

export type ParseResult = { ok: true; data: ExportData } | { ok: false; error: string }

/** Parses and validates a backup file's text. Never throws. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }
  const parsed = ExportDataSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'That file is not a c4-learning backup.' }

  const ids = new Set(parsed.data.children.map((c) => c.id))
  if (ids.size !== parsed.data.children.length) return { ok: false, error: 'The backup has duplicate children.' }
  const orphan = [...parsed.data.progress, ...parsed.data.mastery].some((r) => !ids.has(r.childId))
  if (orphan) return { ok: false, error: 'The backup has progress for a child that is not in it.' }
  return { ok: true, data: parsed.data }
}

export const backupFilename = (now = new Date()) => `c4-learning-backup-${now.toISOString().slice(0, 10)}.json`
