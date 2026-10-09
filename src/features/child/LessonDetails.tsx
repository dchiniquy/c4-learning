import type { Lesson } from '../../content/schema.ts'

/** What a grown-up needs to teach a lesson: each activity's materials and steps. */
export default function LessonDetails({ lesson }: { lesson: Lesson }) {
  return (
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
  )
}
