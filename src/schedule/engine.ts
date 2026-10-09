import {
  SCREEN_BUDGET_MINUTES,
  type ContentBundle,
  type Grade,
  type Lesson,
  type ScheduleBlock,
  type ScheduleTemplate,
} from '../content/schema.ts'

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
}

export type DayPlan = {
  items: DayItem[]
  screen: { planned: number; completed: number; budget: number }
}

/** What a child's day looks like: blocks in time order, which are done, and screen-time totals. */
export function planDay(
  content: Pick<ContentBundle, 'lessons'>,
  template: ScheduleTemplate,
  weekday: number,
  doneKeys: ReadonlySet<string>,
): DayPlan {
  const lessons = new Map(content.lessons.map((l) => [l.id, l]))
  const items = template.blocks
    .filter((b) => b.day === weekday)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
    .map<DayItem>((block) => {
      const key = blockKey(template, block)
      return { key, block, end: endTime(block), done: doneKeys.has(key), lesson: block.lessonId ? lessons.get(block.lessonId) : undefined }
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
