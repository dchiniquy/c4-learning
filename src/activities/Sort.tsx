import { useState } from 'react'
import { speak } from '../audio/narration.ts'
import { TRY_AGAIN } from './MultipleChoice.tsx'
import type { Sort as Payload } from './payloads.ts'
import type { ActivityProps } from './types.ts'

/** Tap an item, then tap its group. (Tap-to-place instead of dragging, so it works for everyone.) */
export default function Sort({ payload, onSolved }: ActivityProps<Payload>) {
  const [selected, setSelected] = useState<string>()
  const [placed, setPlaced] = useState<Record<string, string>>({})
  const [attempts, setAttempts] = useState(0)
  const [feedback, setFeedback] = useState('')

  const remaining = payload.items.filter((i) => !(i.id in placed))

  function place(categoryId: string) {
    const item = payload.items.find((i) => i.id === selected)
    if (!item) return setFeedback('Tap a word first.')
    const count = attempts + 1
    setAttempts(count)
    if (item.categoryId === categoryId) {
      const next = { ...placed, [item.id]: categoryId }
      setPlaced(next)
      setSelected(undefined)
      setFeedback('Yes!')
      if (Object.keys(next).length === payload.items.length) {
        setFeedback('You sorted them all!')
        speak('You sorted them all!')
        onSolved({ attempts: count })
      }
    } else {
      setFeedback(TRY_AGAIN)
      speak(TRY_AGAIN)
    }
  }

  return (
    <div>
      <div className="choice-grid" role="group" aria-label="Words to sort">
        {remaining.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`big-button tile${selected === item.id ? ' selected' : ''}`}
            aria-pressed={selected === item.id}
            onClick={() => {
              setSelected(item.id)
              speak(item.label)
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="sort-groups">
        {payload.categories.map((cat) => (
          <section key={cat.id} aria-label={`Group ${cat.label}`}>
            <button type="button" className="big-button group" onClick={() => place(cat.id)}>
              {cat.label}
            </button>
            <ul>
              {payload.items.filter((i) => placed[i.id] === cat.id).map((i) => (
                <li key={i.id}>{i.label}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p role="status" className="feedback">{feedback}</p>
    </div>
  )
}
