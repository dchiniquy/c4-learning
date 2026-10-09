import { useState } from 'react'
import { speak } from '../audio/narration.ts'
import { TRY_AGAIN } from './MultipleChoice.tsx'
import type { NumberLine as Payload } from './payloads.ts'
import type { ActivityProps } from './types.ts'

export default function NumberLine({ payload, onSolved }: ActivityProps<Payload>) {
  const [attempts, setAttempts] = useState(0)
  const [solved, setSolved] = useState(false)
  const [feedback, setFeedback] = useState('')
  const numbers = Array.from({ length: payload.max - payload.min + 1 }, (_, i) => payload.min + i)

  function pick(n: number) {
    if (solved) return
    const count = attempts + 1
    setAttempts(count)
    if (n === payload.target) {
      setSolved(true)
      setFeedback('Yes! You found it!')
      speak('Yes! You found it!')
      onSolved({ attempts: count })
    } else {
      setFeedback(TRY_AGAIN)
      speak(TRY_AGAIN)
    }
  }

  return (
    <div>
      <div className="number-line" role="group" aria-label={`Numbers ${payload.min} to ${payload.max}`}>
        {numbers.map((n) => (
          <button key={n} type="button" className={`big-button tile${solved && n === payload.target ? ' done' : ''}`} onClick={() => pick(n)}>
            {n}
          </button>
        ))}
      </div>
      <p role="status" className="feedback">{feedback}</p>
    </div>
  )
}
