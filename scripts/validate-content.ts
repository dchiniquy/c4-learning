import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import {
  LessonSchema,
  ScheduleTemplateSchema,
  SkillSchema,
  StandardSchema,
  type ContentBundle,
} from '../src/content/schema.ts'
import { validateContent } from '../src/content/validate.ts'

const ROOT = join(import.meta.dirname, '..', 'content')

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return jsonFiles(path)
    return name.endsWith('.json') ? [path] : []
  })
}

const errors: string[] = []

/** Each content file holds either one item or an array of items. */
function load<T>(folder: string, schema: z.ZodType<T>): T[] {
  const out: T[] = []
  for (const file of jsonFiles(join(ROOT, folder))) {
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
      else {
        for (const issue of parsed.error.issues) errors.push(`${file}: ${issue.path.join('.')}: ${issue.message}`)
      }
    }
  }
  return out
}

const bundle: ContentBundle = {
  standards: load('standards', StandardSchema),
  skills: load('skills', SkillSchema),
  lessons: load('lessons', LessonSchema),
  schedules: load('schedules', ScheduleTemplateSchema),
}

errors.push(...validateContent(bundle))

if (errors.length) {
  console.error(`Content validation failed (${errors.length}):\n` + errors.map((e) => `  - ${e}`).join('\n'))
  process.exit(1)
}
console.log(
  `Content OK: ${bundle.standards.length} standards, ${bundle.skills.length} skills, ` +
    `${bundle.lessons.length} lessons, ${bundle.schedules.length} schedules`,
)
