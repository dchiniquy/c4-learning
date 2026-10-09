import { isInteractive, PAYLOAD_SCHEMAS } from '../activities/payloads.ts'
import { SCREEN_BUDGET_MINUTES, type ContentBundle } from './schema.ts'

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Cross-reference checks that per-file Zod schemas can't express. Returns human-readable errors. */
export function validateContent(bundle: ContentBundle): string[] {
  const errors: string[] = []

  const index = <T extends { id: string }>(kind: string, items: T[]) => {
    const map = new Map<string, T>()
    for (const item of items) {
      if (map.has(item.id)) errors.push(`duplicate ${kind} id "${item.id}"`)
      map.set(item.id, item)
    }
    return map
  }

  const standards = index('standard', bundle.standards)
  const skills = index('skill', bundle.skills)
  const lessons = index('lesson', bundle.lessons)
  const sequences = index('sequence', bundle.sequences)
  index('schedule', bundle.schedules)

  for (const skill of bundle.skills) {
    for (const sid of skill.standardIds) {
      if (!standards.has(sid)) errors.push(`skill "${skill.id}" references unknown standard "${sid}"`)
    }
    for (const pid of skill.prerequisites) {
      if (!skills.has(pid)) errors.push(`skill "${skill.id}" has unknown prerequisite "${pid}"`)
    }
  }

  // Prerequisite cycles (depth-first with a visiting set).
  const state = new Map<string, 'visiting' | 'done'>()
  const visit = (id: string, path: string[]) => {
    if (state.get(id) === 'done') return
    if (state.get(id) === 'visiting') {
      errors.push(`prerequisite cycle: ${[...path, id].join(' -> ')}`)
      return
    }
    state.set(id, 'visiting')
    for (const pid of skills.get(id)?.prerequisites ?? []) {
      if (skills.has(pid)) visit(pid, [...path, id])
    }
    state.set(id, 'done')
  }
  for (const id of skills.keys()) visit(id, [])

  for (const lesson of bundle.lessons) {
    for (const sid of lesson.skillIds) {
      const skill = skills.get(sid)
      if (!skill) {
        errors.push(`lesson "${lesson.id}" references unknown skill "${sid}"`)
        continue
      }
      for (const stdId of skill.standardIds) {
        const std = standards.get(stdId)
        if (std && !std.verified) {
          errors.push(
            `lesson "${lesson.id}" relies on unverified standard "${std.code}" (${std.id}); verify it against ${std.source} first`,
          )
        }
      }
    }
    for (const act of lesson.activities) {
      if (act.mode === 'offline' && act.leadBy === 'app') {
        errors.push(`activity "${act.id}" in "${lesson.id}" is offline but led by the app`)
      }
      if (act.mode === 'screen' && !act.audio && !act.prompt && (lesson.grade === 'prek' || lesson.grade === 'k')) {
        errors.push(`screen activity "${act.id}" in "${lesson.id}" needs a prompt or audio (non-readers)`)
      }
      if (act.mode === 'screen' && isInteractive(act.type)) {
        if (!act.prompt) errors.push(`interactive activity "${act.id}" in "${lesson.id}" needs a prompt`)
        const parsed = PAYLOAD_SCHEMAS[act.type].safeParse(act.payload)
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            errors.push(`activity "${act.id}" in "${lesson.id}": payload.${issue.path.join('.')}: ${issue.message}`)
          }
        }
      }
    }
  }

  for (const seq of bundle.sequences) {
    for (const lid of seq.lessonIds) {
      const lesson = lessons.get(lid)
      if (!lesson) errors.push(`sequence "${seq.id}" references unknown lesson "${lid}"`)
      else if (lesson.grade !== seq.grade || lesson.subject !== seq.subject) {
        errors.push(`sequence "${seq.id}" (${seq.grade} ${seq.subject}) includes "${lid}" (${lesson.grade} ${lesson.subject})`)
      }
    }
    if (new Set(seq.lessonIds).size !== seq.lessonIds.length) errors.push(`sequence "${seq.id}" lists a lesson twice`)
  }

  for (const sched of bundle.schedules) {
    const screenByDay = new Map<number, number>()
    const blocksByDay = new Map<number, typeof sched.blocks>()
    for (const block of sched.blocks) {
      if (block.mode === 'offline' && block.leadBy === 'app') {
        errors.push(`schedule "${sched.id}" has an offline block "${block.label}" led by the app`)
      }
      if (block.lessonId) {
        const lesson = lessons.get(block.lessonId)
        if (!lesson) errors.push(`schedule "${sched.id}" references unknown lesson "${block.lessonId}"`)
        else if (lesson.grade !== sched.grade) {
          errors.push(`schedule "${sched.id}" (${sched.grade}) uses lesson "${lesson.id}" from grade ${lesson.grade}`)
        }
      }
      if (block.sequenceId) {
        const seq = sequences.get(block.sequenceId)
        if (!seq) errors.push(`schedule "${sched.id}" references unknown sequence "${block.sequenceId}"`)
        else if (seq.grade !== sched.grade) {
          errors.push(`schedule "${sched.id}" (${sched.grade}) uses sequence "${seq.id}" from grade ${seq.grade}`)
        }
      }
      if (block.mode === 'screen') {
        screenByDay.set(block.day, (screenByDay.get(block.day) ?? 0) + block.minutes)
      }
      blocksByDay.set(block.day, [...(blocksByDay.get(block.day) ?? []), block])
    }

    const budget = SCREEN_BUDGET_MINUTES[sched.grade]
    for (const [day, minutes] of screenByDay) {
      if (minutes > budget) {
        errors.push(`schedule "${sched.id}" day ${day}: ${minutes} screen min exceeds ${sched.grade} budget of ${budget}`)
      }
    }

    for (const [day, blocks] of blocksByDay) {
      const sorted = [...blocks].sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]
        if (toMinutes(prev.start) + prev.minutes > toMinutes(sorted[i].start)) {
          errors.push(`schedule "${sched.id}" day ${day}: "${prev.label}" overlaps "${sorted[i].label}"`)
        }
      }
    }
  }

  return errors
}
