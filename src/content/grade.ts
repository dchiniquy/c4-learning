import type { ContentBundle, Grade } from './schema.ts'

/** Everything the app needs to teach one grade. Standards are separate because only the progress report reads them. */
export type GradeContent = Pick<ContentBundle, 'skills' | 'lessons' | 'sequences' | 'schedules'>

/** The slice of a full bundle that belongs to one grade. Used by the build plugin and by tests. */
export function forGrade(bundle: Pick<ContentBundle, 'skills' | 'lessons' | 'sequences' | 'schedules'>, grade: Grade): GradeContent {
  const lessons = bundle.lessons.filter((l) => l.grade === grade)
  const skillIds = new Set(lessons.flatMap((l) => l.skillIds))
  return {
    lessons,
    skills: bundle.skills.filter((s) => skillIds.has(s.id)),
    sequences: bundle.sequences.filter((s) => s.grade === grade),
    schedules: bundle.schedules.filter((s) => s.grade === grade),
  }
}
