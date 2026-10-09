import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { isInteractive } from '../../activities/payloads.ts'
import { narrate, stopNarration } from '../../audio/narration.ts'
import { SUBJECT_EMOJI } from '../../content/labels.ts'
import { formatTime, type DayItem } from '../../schedule/engine.ts'
import type { Child } from '../../store/types.ts'
import LessonDetails from './LessonDetails.tsx'
import { useDayPlan } from './useDayPlan.ts'

const emojiFor = (item: DayItem) => (item.block.mode === 'screen' ? '🎮' : SUBJECT_EMOJI[item.block.subject])

/**
 * The child's own view of today: one big "next up" card with a picture, read aloud for the youngest,
 * a picture strip of the day, and a celebration at the end. No clock times or limits to worry about.
 */
export default function ChildDay({ child }: { child: Child }) {
  const { template, plan, toggle } = useDayPlan(child)
  const autoRead = child.grade === 'prek' || child.grade === 'k'

  const items = plan?.items ?? []
  const next = items.find((i) => !i.done)
  const doneCount = items.filter((i) => i.done).length
  const spoken = !plan || items.length === 0 ? undefined : next ? `Next up: ${next.block.label}` : 'All done for today. Great job!'

  useEffect(() => {
    if (!autoRead || !spoken) return
    narrate({ text: spoken })
    return stopNarration
  }, [autoRead, spoken])

  if (!template) return <p>No schedule is set up for this level yet. A grown-up can check the plan.</p>
  if (!plan) return <p role="status">Loading today…</p>
  if (items.length === 0) return <p className="all-done">No lessons today. Enjoy your day! 🌈</p>

  const playable = !!next?.lesson && next.block.mode === 'screen' && next.lesson.activities.some((a) => a.mode === 'screen' && isInteractive(a.type))

  return (
    <section aria-label="Your day">
      {next ? (
        <article className={`next-card subject-${next.block.subject}`}>
          <p className="next-kicker">Next up</p>
          <p className="next-emoji" aria-hidden="true">
            {emojiFor(next)}
          </p>
          <h2>{next.block.label}</h2>
          <p className="next-time">{formatTime(next.block.start)}</p>
          <button type="button" className="big-button speaker" aria-label="Hear what is next" onClick={() => narrate({ text: spoken! })}>
            <span aria-hidden="true">🔊</span>
          </button>
          {playable ? (
            <p>
              <Link className="big-button start" to={`/child/${child.id}/lesson/${next.lesson!.id}?block=${encodeURIComponent(next.key)}`}>
                Let's play!
              </Link>
            </p>
          ) : (
            <>
              {next.block.leadBy === 'parent' && <p>Ask your grown-up to help you.</p>}
              <p>
                <button type="button" className="big-button" onClick={() => void toggle(next.key, true, next.lesson?.id)}>
                  I did it!
                </button>
              </p>
            </>
          )}
          {next.lesson && <LessonDetails lesson={next.lesson} />}
        </article>
      ) : (
        <article className="next-card all-done">
          <p className="next-emoji" aria-hidden="true">
            🎉
          </p>
          <h2>All done for today!</h2>
          <p>Great job, {child.name}!</p>
        </article>
      )}

      <p className="progress-line">
        <span aria-hidden="true">⭐ </span>
        {doneCount} of {items.length} done
      </p>
      <ol className="day-strip" aria-label="Your day in pictures">
        {items.map((item) => (
          <li
            key={item.key}
            className={`chip subject-${item.block.subject}${item.done ? ' done' : ''}${item === next ? ' current' : ''}`}
            aria-label={`${item.block.label}: ${item.done ? 'done' : 'to do'}${item === next ? ', next' : ''}`}
          >
            <span aria-hidden="true">{emojiFor(item)}</span>
            {item.done && (
              <span className="tick" aria-hidden="true">
                ✓
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
