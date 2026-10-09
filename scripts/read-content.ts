import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { z } from 'zod'
import {
  LessonSchema,
  ScheduleTemplateSchema,
  SequenceSchema,
  SkillSchema,
  StandardSchema,
  type ContentBundle,
} from '../src/content/schema.ts'
import { validateContent } from '../src/content/validate.ts'

const ROOT = join(import.meta.dirname, '..', 'content')

function jsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [] // a content folder that doesn't exist yet is just empty
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return jsonFiles(path)
    return name.endsWith('.json') ? [path] : []
  })
}

/** Reads, parses and cross-checks everything under content/. Shared by the validator and the exporters. */
export function readContent(): { bundle: ContentBundle; errors: string[]; files: string[] } {
  const errors: string[] = []
  const files: string[] = []

  /** Each content file holds either one item or an array of items. */
  function load<T>(folder: string, schema: z.ZodType<T>): T[] {
    const out: T[] = []
    for (const file of jsonFiles(join(ROOT, folder))) {
      files.push(file)
      let raw: unknown
      try {
        raw = JSON.parse(readFileSync(file, 'utf8'))
      } catch (e) {
        errors.push(`${file}: invalid JSON (${(e as Error).message})`)
        continue
      }
      for (const item of Array.isArray(raw) ? raw : [raw]) {
        const parsed = schema.safeParse(item)
        if (parsed.success) out.push(parsed.data)
        else for (const issue of parsed.error.issues) errors.push(`${file}: ${issue.path.join('.')}: ${issue.message}`)
      }
    }
    return out
  }

  const bundle: ContentBundle = {
    standards: load('standards', StandardSchema),
    skills: load('skills', SkillSchema),
    lessons: load('lessons', LessonSchema),
    sequences: load('sequences', SequenceSchema),
    schedules: load('schedules', ScheduleTemplateSchema),
  }
  errors.push(...validateContent(bundle))
  return { bundle, errors, files }
}
