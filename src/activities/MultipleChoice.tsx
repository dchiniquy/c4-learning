import { useState } from 'react'
import { speak } from '../audio/narration.ts'
import type { MultipleChoice as Payload } from './payloads.ts'
import type { ActivityProps } from './types.ts'

export const TRY_AGAIN = 'Not quite. Try again!'

export default function MultipleChoice({ payload, onSolved }: ActivityProps<Payload>) {
  const [attempts, setAttempts] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [solvedId, setSolvedId] = useState<string>()

  function choose(id: string) {
    if (solvedId) return
    const n = attempts + 1
    setAttempts(n)
    if (id === payload.correctId) {
      setSolvedId(id)
      setFeedback('Yes! You got it!')
      speak('Yes! You got it!')
      onSolved({ attempts: n })
    } else {
      setFeedback(TRY_AGAIN)
      speak(TRY_AGAIN)
    }
  }

  return (
    <div>
      {payload.stem && <p className="stem" role="img" aria-label={payload.stem}>{payload.stem}</p>}
      <div className="choice-grid">
        {payload.choices.map((c) => (
          <button key={c.id} type="button" className={`big-button tile${solvedId === c.id ? ' done' : ''}`} disabled={!!solvedId && solvedId !== c.id} onClick={() => choose(c.id)}>
            {c.emoji && <span aria-hidden="true">{c.emoji} </span>}
            {c.label}
          </button>
        ))}
      </div>
      <p role="status" className="feedback">{feedback}</p>
    </div>
  )
}
