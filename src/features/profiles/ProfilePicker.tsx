import { Link } from 'react-router-dom'
import { useApp } from '../../store/appStore.ts'

export default function ProfilePicker() {
  const ready = useApp((s) => s.ready)
  const children = useApp((s) => s.children)

  if (!ready) return <p role="status">Loading…</p>

  return (
    <section>
      <h1>Who is learning today?</h1>
      {children.length === 0 ? (
        <p>No learners yet. A parent can add them in the parent area.</p>
      ) : (
        <ul className="profile-grid">
          {children.map((child) => (
            <li key={child.id}>
              <Link className="profile-card" to={`/child/${child.id}`}>
                <span className="avatar" aria-hidden="true">
                  {child.avatar}
                </span>
                <span>{child.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p>
        <Link to="/parent">Parent area</Link>
      </p>
    </section>
  )
}
