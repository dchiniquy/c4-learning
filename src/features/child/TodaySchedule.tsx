import { useEffect, useMemo, useState } from 'react'
import { useContent } from '../../content/context.ts'
import { formatTime, isoWeekday, localDateString, planDay, templateForGrade } from '../../schedule/engine.ts'
import { useApp } from '../../store/appStore.ts'
import type { Child } from '../../store/types.ts'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function TodaySchedule({ child }: { child: Child }) {
  const content = useContent()
  const loadChecks = useApp((s) => s.loadChecks)
  const setBlockDone = useApp((s) => s.setBlockDone)

  const [now] = useState(() => new Date())
  const date = localDateString(now)
  const weekday = isoWeekday(now)
  const template = templateForGrade(content.schedules, child.grade)

  // Check-offs are tagged with the child and date they were loaded for, so switching child never shows stale ticks.
  const scope = `${child.id}|${date}`
  const [loaded, setLoaded] = useState<{ scope: string; keys: ReadonlySet<string> } | null>(null)
  const doneKeys = loaded?.scope === scope ? loaded.keys : null
  useEffect(() => {
    let cancelled = false
    void loadChecks(child.id, date).then((checks) => {
      if (!cancelled) setLoaded({ scope, keys: new Set(checks.map((c) => c.blockKey)) })
    })
    return () => {
      cancelled = true
    }
  }, [loadChecks, child.id, date, scope])

  const plan = useMemo(
    () => (template && doneKeys ? planDay(content, template, weekday, doneKeys) : null),
    [content, template, weekday, doneKeys],
  )

  async function toggle(key: string, done: boolean) {
    setLoaded((prev) => {
      const next = new Set(prev?.keys)
      if (done) next.add(key)
      else next.delete(key)
      return { scope, keys: next }
    })
    await setBlockDone(child.id, date, key, done)
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
            {plan.items.map(({ key, block, end, done, lesson }) => (
              <li key={key}>
                <label className="schedule-row">
                  <input type="checkbox" checked={done} onChange={(e) => void toggle(key, e.target.checked)} />
                  <span>
                    <strong>{block.label}</strong>
                    <br />
                    {formatTime(block.start)} to {formatTime(end)} · {block.minutes} min ·{' '}
                    {block.mode === 'screen' ? 'on a screen' : 'away from the screen'}
                  </span>
                </label>
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
