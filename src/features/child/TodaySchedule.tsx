import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { isInteractive } from '../../activities/payloads.ts'
import { useContent } from '../../content/context.ts'
import { formatTime, isoWeekday, localDateString, planDay, templateForGrade } from '../../schedule/engine.ts'
import { useApp } from '../../store/appStore.ts'
import type { Child, ScheduleCheck } from '../../store/types.ts'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function TodaySchedule({ child }: { child: Child }) {
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

  const plan = useMemo(
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

  if (!template) return <p>No schedule is set up for this level yet.</p>
  if (!plan) return <p role="status">Loading today…</p>

  return (
    <section aria-labelledby="today-heading">
      <h2 id="today-heading">{WEEKDAYS[weekday - 1]}</h2>
      {plan.items.length === 0 ? (
        <p>No lessons are scheduled today. Enjoy your day!</p>
      ) : (
        <>
          <p>
            <label>
              App time today: {plan.screen.completed} of {plan.screen.planned} min (limit {plan.screen.budget} min)
              <progress value={plan.screen.completed} max={Math.max(plan.screen.planned, 1)} />
            </label>
          </p>
          <ol className="schedule">
            {plan.items.map(({ key, block, end, done, lesson, sequenceFinished }) => (
              <li key={key}>
                <label className="schedule-row">
                  <input type="checkbox" checked={done} onChange={(e) => void toggle(key, e.target.checked, lesson?.id)} />
                  <span>
                    <strong>{block.label}</strong>
                    <br />
                    {formatTime(block.start)} to {formatTime(end)} · {block.minutes} min ·{' '}
                    {block.mode === 'screen' ? 'on a screen' : 'away from the screen'}
                  </span>
                </label>
                {lesson && block.mode === 'screen' && lesson.activities.some((a) => a.mode === 'screen' && isInteractive(a.type)) && (
                  <p>
                    <Link className="big-button start" to={`/child/${child.id}/lesson/${lesson.id}?block=${encodeURIComponent(key)}`}>
                      Start {block.label}
                    </Link>
                  </p>
                )}
                {sequenceFinished && <p>You've finished all the lessons we have for this. New ones are coming!</p>}
                {lesson && (
                  <details>
                    <summary>For the grown-up: {lesson.title}</summary>
                    {lesson.activities.map((a) => (
                      <div key={a.id}>
                        <h3>
                          {a.title} ({a.minutes} min, {a.mode === 'screen' ? 'app' : 'hands-on'})
                        </h3>
                        {a.materials.length > 0 && (
                          <p>
                            <strong>You'll need:</strong> {a.materials.join(', ')}
                          </p>
                        )}
                        {a.parentPrompts.length > 0 && (
                          <ul>
                            {a.parentPrompts.map((p) => (
                              <li key={p}>{p}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </details>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
