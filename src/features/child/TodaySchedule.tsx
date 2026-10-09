import { Link } from 'react-router-dom'
import { isInteractive } from '../../activities/payloads.ts'
import { formatTime } from '../../schedule/engine.ts'
import type { Child } from '../../store/types.ts'
import LessonDetails from './LessonDetails.tsx'
import { useDayPlan, WEEKDAYS } from './useDayPlan.ts'

/** The grown-up's view of today: every block with times, a checkbox, the app-time meter, and lesson steps. */
export default function TodaySchedule({ child }: { child: Child }) {
  const { template, plan, weekday, toggle } = useDayPlan(child)

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
                {lesson && <LessonDetails lesson={lesson} />}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
