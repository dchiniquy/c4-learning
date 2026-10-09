import { useEffect } from 'react'
import { narrate, stopNarration } from '../audio/narration.ts'
import type { Activity } from '../content/schema.ts'

/** The instruction for an activity: shown large, read aloud automatically, with a button to hear it again. */
export default function PromptBar({ activity, autoRead }: { activity: Activity; autoRead: boolean }) {
  const text = activity.prompt ?? activity.title
  const audio = activity.audio

  useEffect(() => {
    if (autoRead) narrate({ text, audio })
    return stopNarration
  }, [autoRead, text, audio])

  return (
    <div className="prompt-bar">
      <button type="button" className="big-button speaker" aria-label="Hear the instructions again" onClick={() => narrate({ text, audio })}>
        <span aria-hidden="true">🔊</span>
      </button>
      <p className="prompt-text">{text}</p>
    </div>
  )
}
