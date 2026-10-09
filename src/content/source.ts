import { forGrade, type GradeContent } from './grade.ts'
import type { ContentBundle, Grade, Standard } from './schema.ts'

/** Where lesson content comes from. The app asks for one grade at a time so a family only downloads what it uses. */
export interface ContentSource {
  loadGrade(grade: Grade): Promise<GradeContent>
  loadStandards(): Promise<Standard[]>
}

// Each import becomes its own chunk, created from content/ by the c4-content plugin.
const gradeModules: Record<Grade, () => Promise<{ default: GradeContent }>> = {
  prek: () => import('virtual:c4-content/grade-prek'),
  k: () => import('virtual:c4-content/grade-k'),
  '1': () => import('virtual:c4-content/grade-1'),
  '2': () => import('virtual:c4-content/grade-2'),
  '3': () => import('virtual:c4-content/grade-3'),
}

/** The real content, loaded on demand and cached. */
export function bundledSource(): ContentSource {
  const grades = new Map<Grade, Promise<GradeContent>>()
  let standards: Promise<Standard[]> | undefined
  return {
    loadGrade(grade) {
      let p = grades.get(grade)
      if (!p) {
        p = gradeModules[grade]().then((m) => m.default)
        p.catch(() => grades.delete(grade)) // a failed load can be retried
        grades.set(grade, p)
      }
      return p
    },
    loadStandards() {
      standards ??= import('virtual:c4-content/standards').then((m) => m.default)
      standards.catch(() => (standards = undefined))
      return standards
    },
  }
}

/** A source backed by an in-memory bundle, for tests. */
export function eagerSource(bundle: ContentBundle): ContentSource {
  return {
    loadGrade: async (grade) => forGrade(bundle, grade),
    loadStandards: async () => bundle.standards,
  }
}
