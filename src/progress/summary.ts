import type { ContentBundle, Grade, Lesson, Skill, Standard, Subject } from '../content/schema.ts'
import { SUBJECTS } from '../content/schema.ts'
import type { ScheduleCheck, SkillMastery } from '../store/types.ts'

/** Shown to parents. "Not started" and "Practicing" are worked out from lessons done; the other two are the parent's call. */
export type SkillLevel = SkillMastery['level']
export const LEVEL_LABEL: Record<SkillLevel, string> = {
  'not-started': 'Not started',
  practicing: 'Practicing',
  proficient: 'Doing well',
  mastered: 'Got it',
}

export type SkillProgress = {
  skill: Skill
  standards: Standard[]
  lessonsTotal: number
  lessonsDone: number
  /** The level shown: the parent's mark if there is one, else worked out from lessons done. */
  level: SkillLevel
  /** True when `level` came from the parent rather than from lessons done. */
  marked: boolean
}

export type SubjectProgress = { subject: Subject; skills: SkillProgress[]; lessonsDone: number; lessonsTotal: number }

export type RecentLesson = { lesson: Lesson; date: string }

export type ProgressSummary = {
  grade: Grade
  lessonsDone: number
  lessonsTotal: number
  /** Distinct calendar days with at least one lesson or block checked off. */
  daysActive: number
  standardsWorkedOn: number
  standardsAvailable: number
  bySubject: SubjectProgress[]
  recent: RecentLesson[]
}

const dayMs = 24 * 60 * 60 * 1000

/**
 * What a child has done so far at their level. Progress is counted from check-offs that record which
 * lesson was done; no scores are invented. `today` (YYYY-MM-DD) anchors the "last 7 days" list.
 */
export function summarizeProgress(
  content: Pick<ContentBundle, 'lessons' | 'skills' | 'standards'>,
  grade: Grade,
  checks: readonly ScheduleCheck[],
  marks: readonly SkillMastery[],
  today: string,
): ProgressSummary {
  const lessons = content.lessons.filter((l) => l.grade === grade)
  const lessonById = new Map(lessons.map((l) => [l.id, l]))
  const skillById = new Map(content.skills.map((s) => [s.id, s]))
  const standardById = new Map(content.standards.map((s) => [s.id, s]))
  const markBySkill = new Map(marks.map((m) => [m.skillId, m.level]))

  const doneIds = new Set(checks.flatMap((c) => (c.lessonId && lessonById.has(c.lessonId) ? [c.lessonId] : [])))

  const skillIds = [...new Set(lessons.flatMap((l) => l.skillIds))].filter((id) => skillById.has(id))
  const skills = skillIds.map<SkillProgress>((id) => {
    const skill = skillById.get(id)!
    const using = lessons.filter((l) => l.skillIds.includes(id))
    const lessonsDone = using.filter((l) => doneIds.has(l.id)).length
    const mark = markBySkill.get(id)
    return {
      skill,
      standards: skill.standardIds.map((sid) => standardById.get(sid)).filter((s) => !!s),
      lessonsTotal: using.length,
      lessonsDone,
      level: mark ?? (lessonsDone > 0 ? 'practicing' : 'not-started'),
      marked: mark !== undefined,
    }
  })

  const bySubject = SUBJECTS.map<SubjectProgress>((subject) => {
    const inSubject = skills.filter((s) => s.skill.subject === subject)
    const subjectLessons = lessons.filter((l) => l.subject === subject)
    return {
      subject,
      skills: inSubject.sort((a, b) => a.skill.name.localeCompare(b.skill.name)),
      lessonsDone: subjectLessons.filter((l) => doneIds.has(l.id)).length,
      lessonsTotal: subjectLessons.length,
    }
  }).filter((s) => s.skills.length > 0 || s.lessonsTotal > 0)

  const workedOn = new Set(skills.filter((s) => s.lessonsDone > 0).flatMap((s) => s.standards.map((st) => st.id)))
  const available = new Set(skills.flatMap((s) => s.standards.map((st) => st.id)))

  const cutoff = new Date(`${today}T00:00:00`).getTime() - 6 * dayMs
  const recent = checks
    .filter((c) => c.lessonId && lessonById.has(c.lessonId) && c.date <= today && new Date(`${c.date}T00:00:00`).getTime() >= cutoff)
    .map((c) => ({ lesson: lessonById.get(c.lessonId!)!, date: c.date }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.lesson.title.localeCompare(b.lesson.title))

  return {
    grade,
    lessonsDone: doneIds.size,
    lessonsTotal: lessons.length,
    daysActive: new Set(checks.map((c) => c.date)).size,
    standardsWorkedOn: workedOn.size,
    standardsAvailable: available.size,
    bySubject,
    recent,
  }
}
