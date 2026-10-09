import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import GradeContent from '../../content/GradeContent.tsx'
import { useApp } from '../../store/appStore.ts'
import ChildDay from './ChildDay.tsx'

export default function ChildHome() {
  const { childId } = useParams()
  const ready = useApp((s) => s.ready)
  const child = useApp((s) => s.children.find((c) => c.id === childId))
  const lock = useApp((s) => s.lock)

  // Entering a child's view always re-locks the parent area.
  useEffect(() => lock(), [lock])

  if (!ready) return <p role="status">Loading…</p>
  if (!child) return <Navigate to="/" replace />

  return (
    <section>
      <h1>
        <span aria-hidden="true">{child.avatar} </span>Hi, {child.name}!
      </h1>
      <GradeContent grade={child.grade}>
        <ChildDay child={child} />
      </GradeContent>
      <p className="footer-links">
        <Link to={`/child/${child.id}/plan`}>Grown-up plan</Link> · <Link to="/">Switch learner</Link>
      </p>
    </section>
  )
}
