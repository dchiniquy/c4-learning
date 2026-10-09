import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ActivityPlayer from '../../activities/ActivityPlayer.tsx'
import { isInteractive } from '../../activities/payloads.ts'
import { useContent } from '../../content/context.ts'
import GradeContent from '../../content/GradeContent.tsx'
import { localDateString } from '../../schedule/engine.ts'
import { useApp } from '../../store/appStore.ts'
import type { Child } from '../../store/types.ts'

export default function LessonPage() {
  const { childId, lessonId } = useParams()
  const ready = useApp((s) => s.ready)
  const child = useApp((s) => s.children.find((c) => c.id === childId))

  if (!ready) return <p role="status">Loading…</p>
  if (!child) return <Navigate to="/" replace />
  return (
    <GradeContent grade={child.grade}>
      <LessonPlayer child={child} lessonId={lessonId} />
    </GradeContent>
  )
}

/** Plays a lesson's on-screen activities one after another, saves progress, and ticks the schedule block when done. */
function LessonPlayer({ child, lessonId }: { child: Child; lessonId: string | undefined }) {
  const [search] = useSearchParams()
  const blockKey = search.get('block')
  const navigate = useNavigate()

  const content = useContent()
  const recordActivity = useApp((s) => s.recordActivity)
  const setBlockDone = useApp((s) => s.setBlockDone)

  const lesson = content.lessons.find((l) => l.id === lessonId)
  const activities = lesson?.activities.filter((a) => a.mode === 'screen' && isInteractive(a.type)) ?? []

  const [index, setIndex] = useState(0)
  const [solved, setSolved] = useState(false)
  const [startedAt, setStartedAt] = useState(() => Date.now())

  if (!lesson || activities.length === 0) return <Navigate to={`/child/${child.id}`} replace />

  const current = lesson // narrowed copy, for the handlers below
  const activity = activities[index]
  const last = index + 1 === activities.length
  // Young learners hear instructions automatically; older ones can tap the speaker.
  const autoRead = child.grade === 'prek' || child.grade === 'k'

  async function onSolved({ attempts }: { attempts: number }) {
    setSolved(true)
    const seconds = Math.round((Date.now() - startedAt) / 1000)
    await recordActivity({ childId: child.id, lessonId: current.id, lessonVersion: current.version, activityId: activity.id, attempts, timeSpentSec: seconds })
  }

  async function next() {
    if (!last) {
      setIndex(index + 1)
      setSolved(false)
      setStartedAt(Date.now())
      return
    }
    if (blockKey) await setBlockDone(child.id, localDateString(new Date()), blockKey, true, current.id)
    navigate(`/child/${child.id}`)
  }

  return (
    <section>
      <p>
        <Link to={`/child/${child.id}`}>Back to today</Link>
      </p>
      <h1>{lesson.title}</h1>
      <p>
        Activity {index + 1} of {activities.length}
      </p>
      <ActivityPlayer key={activity.id} activity={activity} autoRead={autoRead} onSolved={onSolved} />
      {solved && (
        <button type="button" className="big-button next" onClick={() => void next()}>
          {last ? 'All done!' : 'Next'}
        </button>
      )}
    </section>
  )
}
