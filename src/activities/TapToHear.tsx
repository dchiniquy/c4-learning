import { useState } from 'react'
import { speak } from '../audio/narration.ts'
import type { TapToHear as Payload } from './payloads.ts'
import type { ActivityProps } from './types.ts'

export default function TapToHear({ payload, onSolved }: ActivityProps<Payload>) {
  const [heard, setHeard] = useState<ReadonlySet<string>>(new Set())
  const [taps, setTaps] = useState(0)

  function tap(id: string, text: string) {
    speak(text)
    setTaps((n) => n + 1)
    const next = new Set(heard).add(id)
    setHeard(next)
    if (next.size === payload.items.length && heard.size < next.size) onSolved({ attempts: taps + 1 })
  }

  return (
    <div className="choice-grid">
      {payload.items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`big-button tile${heard.has(item.id) ? ' done' : ''}`}
          onClick={() => tap(item.id, item.speak ?? item.label)}
        >
          {item.emoji && <span aria-hidden="true">{item.emoji} </span>}
          {item.label}
          {heard.has(item.id) && <span className="sr-only"> (heard)</span>}
        </button>
      ))}
    </div>
  )
}
