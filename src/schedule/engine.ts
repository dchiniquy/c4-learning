import {
  SCREEN_BUDGET_MINUTES,
  type ContentBundle,
  type Grade,
  type Lesson,
  type ScheduleBlock,
  type ScheduleTemplate,
} from '../content/schema.ts'
import type { ScheduleCheck } from '../store/types.ts'

/** Stable id for a block, used to record that it was done on a given date. */
export const blockKey = (template: ScheduleTemplate, block: ScheduleBlock) => `${template.id}:${block.day}:${block.start}`

/** ISO weekday for a local date: Monday = 1 ... Sunday = 7. */
export const isoWeekday = (d: Date) => ((d.getDay() + 6) % 7) + 1

/** Local calendar date as YYYY-MM-DD (not UTC, so "today" matches the family's clock). */
export function localDateString(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function endTime(block: ScheduleBlock) {
  const total = toMinutes(block.start) + block.minutes
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`
}

/** "13:05" -> "1:05 PM" */
export function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export function templateForGrade(templates: ScheduleTemplate[], grade: Grade) {
  return templates.find((t) => t.grade === grade)
}

export type DayItem = {
  key: string
  block: ScheduleBlock
  end: string
  done: boolean
  lesson?: Lesson
  /** The block draws from a sequence and every lesson in it is already finished. */
  sequenceFinished: boolean
}

export type DayPlan = {
  items: DayItem[]
  screen: { planned: number; completed: number; budget: number }
}

/**
 * What a child's day looks like: blocks in time order, which are done, which
 * lesson each block shows, and screen-time totals.
 *
 * `checks` is every check-off the child has ever made. A block with a fixed
 * lesson always shows it. A block that draws from a sequence shows the lesson
 * it was ticked with today, or otherwise the first lesson in the sequence the
 * child hasn't finished on an earlier day (and isn't already used elsewhere today).
 */
export function planDay(
  content: Pick<ContentBundle, 'lessons'> & Partial<Pick<ContentBundle, 'sequences'>>,
  template: ScheduleTemplate,
  weekday: number,
  checks: readonly ScheduleCheck[],
  date: string,
): DayPlan {
  const lessons = new Map(content.lessons.map((l) => [l.id, l]))
  const sequences = new Map((content.sequences ?? []).map((s) => [s.id, s]))

  const todayChecks = new Map(checks.filter((c) => c.date === date).map((c) => [c.blockKey, c]))
  const finishedEarlier = new Set(checks.filter((c) => c.date !== date && c.lessonId).map((c) => c.lessonId!))
  const usedToday = new Set([...todayChecks.values()].flatMap((c) => (c.lessonId ? [c.lessonId] : [])))

  const items = template.blocks
    .filter((b) => b.day === weekday)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
    .map<DayItem>((block) => {
      const key = blockKey(template, block)
      const check = todayChecks.get(key)
      let lesson = block.lessonId ? lessons.get(block.lessonId) : undefined
      let sequenceFinished = false

      if (block.sequenceId) {
        const ticked = check?.lessonId ? lessons.get(check.lessonId) : undefined
        if (ticked) lesson = ticked
        else {
          const nextId = sequences.get(block.sequenceId)?.lessonIds.find((id) => !finishedEarlier.has(id) && !usedToday.has(id))
          lesson = nextId ? lessons.get(nextId) : undefined
          if (lesson) usedToday.add(lesson.id)
          else sequenceFinished = true
        }
      }
      return { key, block, end: endTime(block), done: !!check, lesson, sequenceFinished }
    })

  const screenItems = items.filter((i) => i.block.mode === 'screen')
  return {
    items,
    screen: {
      planned: screenItems.reduce((sum, i) => sum + i.block.minutes, 0),
      completed: screenItems.filter((i) => i.done).reduce((sum, i) => sum + i.block.minutes, 0),
      budget: SCREEN_BUDGET_MINUTES[template.grade],
    },
  }
}
