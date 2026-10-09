/**
 * Spoken instructions. Plays a recorded clip when the content provides one
 * (public/audio/<path>); otherwise, or if the clip fails to load, reads the text
 * aloud with the browser's built-in speech. Silent (not broken) when neither works.
 */

export const speechSupported = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'

export function speak(text: string) {
  if (!speechSupported()) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 0.85 // a little slower for young listeners
  window.speechSynthesis.speak(utterance)
}

let current: HTMLAudioElement | undefined

export function stopNarration() {
  current?.pause()
  current = undefined
  if (speechSupported()) window.speechSynthesis.cancel()
}

export type Narration = { text: string; audio?: string }

export function narrate({ text, audio }: Narration) {
  stopNarration()
  if (!audio || typeof Audio === 'undefined') return speak(text)
  const el = new Audio(`${import.meta.env.BASE_URL}audio/${audio}`)
  current = el
  el.addEventListener('error', () => speak(text), { once: true })
  el.play().catch(() => speak(text))
}
