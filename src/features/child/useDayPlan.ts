import { useEffect, useMemo, useState } from 'react'
import { useContent } from '../../content/context.ts'
import { isoWeekday, localDateString, planDay, templateForGrade, type DayPlan } from '../../schedule/engine.ts'
import { useApp } from '../../store/appStore.ts'
import type { Child, ScheduleCheck } from '../../store/types.ts'

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** Today's plan for a child, with check-offs loaded from storage and a `toggle` that saves them. */
export function useDayPlan(child: Child) {
  const content = useContent()
  const loadAllChecks = useApp((s) => s.loadAllChecks)
  const setBlockDone = useApp((s) => s.setBlockDone)

  const [now] = useState(() => new Date())
  const date = localDateString(now)
  const weekday = isoWeekday(now)
  const template = templateForGrade(content.schedules, child.grade)

  // Check-offs are tagged with the child and date they were loaded for, so switching child never shows stale ticks.
  const scope = `${child.id}|${date}`
  const [loaded, setLoaded] = useState<{ scope: string; checks: ScheduleCheck[] } | null>(null)
  const checks = loaded?.scope === scope ? loaded.checks : null
  useEffect(() => {
    let cancelled = false
    void loadAllChecks(child.id).then((all) => {
      if (!cancelled) setLoaded({ scope, checks: all })
    })
    return () => {
      cancelled = true
    }
  }, [loadAllChecks, child.id, scope])

  const plan: DayPlan | null = useMemo(
    () => (template && checks ? planDay(content, template, weekday, checks, date) : null),
    [content, template, weekday, checks, date],
  )

  async function toggle(key: string, done: boolean, lessonId?: string) {
    setLoaded((prev) => {
      const rest = (prev?.checks ?? []).filter((c) => !(c.date === date && c.blockKey === key))
      const next = done ? [...rest, { childId: child.id, date, blockKey: key, completedAt: Date.now(), ...(lessonId ? { lessonId } : {}) }] : rest
      return { scope, checks: next }
    })
    await setBlockDone(child.id, date, key, done, lessonId)
  }

  return { template, plan, weekday, date, toggle }
}
