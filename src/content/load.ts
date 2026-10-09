import type { z } from 'zod'
import {
  LessonSchema,
  ScheduleTemplateSchema,
  SkillSchema,
  StandardSchema,
  type ContentBundle,
} from './schema.ts'
import { validateContent } from './validate.ts'

type Modules = Record<string, unknown>

// Everything under content/ is bundled into the app at build time.
const bundledModules: Modules = import.meta.glob('../../content/**/*.json', { eager: true, import: 'default' })

function collect<T>(modules: Modules, folder: string, schema: z.ZodType<T>, errors: string[]): T[] {
  const out: T[] = []
  for (const [path, raw] of Object.entries(modules)) {
    if (!path.includes(`/content/${folder}/`)) continue
    for (const item of Array.isArray(raw) ? raw : [raw]) {
      const parsed = schema.safeParse(item)
      if (parsed.success) out.push(parsed.data)
      else for (const issue of parsed.error.issues) errors.push(`${path}: ${issue.path.join('.')}: ${issue.message}`)
    }
  }
  return out
}

/** Parses and cross-checks the bundled content. Throws with every problem listed if anything is wrong. */
export function loadContentBundle(modules: Modules = bundledModules): ContentBundle {
  const errors: string[] = []
  const bundle: ContentBundle = {
    standards: collect(modules, 'standards', StandardSchema, errors),
    skills: collect(modules, 'skills', SkillSchema, errors),
    lessons: collect(modules, 'lessons', LessonSchema, errors),
    schedules: collect(modules, 'schedules', ScheduleTemplateSchema, errors),
  }
  errors.push(...validateContent(bundle))
  if (errors.length) throw new Error(`Invalid content:\n${errors.map((e) => `  - ${e}`).join('\n')}`)
  return bundle
}
