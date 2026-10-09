import { Link, Navigate, useParams } from 'react-router-dom'
import GradeContent from '../../content/GradeContent.tsx'
import { useApp } from '../../store/appStore.ts'
import TodaySchedule from './TodaySchedule.tsx'

/** The grown-up's plan for the day: full schedule, app-time meter, and steps for each lesson. */
export default function PlanPage() {
  const { childId } = useParams()
  const ready = useApp((s) => s.ready)
  const child = useApp((s) => s.children.find((c) => c.id === childId))

  if (!ready) return <p role="status">Loading…</p>
  if (!child) return <Navigate to="/" replace />

  return (
    <section>
      <p>
        <Link to={`/child/${child.id}`}>Back to {child.name}'s day</Link>
      </p>
      <h1>
        <span aria-hidden="true">{child.avatar} </span>
        {child.name}: plan for the grown-up
      </h1>
      <GradeContent grade={child.grade}>
        <TodaySchedule child={child} />
      </GradeContent>
    </section>
  )
}
