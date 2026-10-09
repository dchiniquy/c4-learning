import { useState } from 'react'
import { speak } from '../audio/narration.ts'
import type { TenFrame as Payload } from './payloads.ts'
import type { ActivityProps } from './types.ts'

const CELLS = 10

/** Counters start filled from the left; the child taps empty spots (or taps one they added to take it back). */
export default function TenFrame({ payload, onSolved }: ActivityProps<Payload>) {
  const [round, setRound] = useState(0)
  const [added, setAdded] = useState<ReadonlySet<number>>(new Set())
  const [taps, setTaps] = useState(0)
  const [roundDone, setRoundDone] = useState(false)

  const start = payload.rounds[round].start
  const isFilled = (i: number) => i < start || added.has(i)
  const total = start + added.size

  function tap(i: number) {
    if (i < start || roundDone) return
    setTaps((n) => n + 1)
    const next = new Set(added)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setAdded(next)
    if (start + next.size === CELLS) {
      const message = `${start} and ${CELLS - start} make ten!`
      setRoundDone(true)
      speak(message)
    }
  }

  function nextRound() {
    if (round + 1 < payload.rounds.length) {
      setRound(round + 1)
      setAdded(new Set())
      setRoundDone(false)
    } else {
      onSolved({ attempts: taps })
    }
  }

  const last = round + 1 === payload.rounds.length

  return (
    <div>
      <p className="stem">
        Round {round + 1} of {payload.rounds.length}: {total} of {CELLS} filled
      </p>
      <div className="ten-frame">
        {Array.from({ length: CELLS }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`big-button cell${isFilled(i) ? ' filled' : ''}`}
            aria-label={`Spot ${i + 1}, ${isFilled(i) ? 'full' : 'empty'}`}
            aria-disabled={i < start || roundDone}
            onClick={() => tap(i)}
          >
            {isFilled(i) ? '●' : ''}
          </button>
        ))}
      </div>
      <p role="status" className="feedback">
        {roundDone ? `${start} and ${CELLS - start} make ten!` : ''}
      </p>
      {roundDone && (
        <button type="button" className="big-button" onClick={nextRound}>
          {last ? 'All done' : 'Next round'}
        </button>
      )}
    </div>
  )
}
