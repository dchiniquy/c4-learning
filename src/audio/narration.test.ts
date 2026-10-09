import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { narrate, speak, speechSupported, stopNarration } from './narration.ts'

class FakeUtterance {
  text: string
  lang = ''
  rate = 1
  constructor(text: string) {
    this.text = text
  }
}

const synth = { speak: vi.fn(), cancel: vi.fn() }

beforeEach(() => {
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(window, 'speechSynthesis')
  synth.speak.mockClear()
  synth.cancel.mockClear()
})

describe('speak', () => {
  it('reads text slowly in US English, cancelling anything already playing', () => {
    speak('Hello')
    expect(synth.cancel).toHaveBeenCalled()
    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance
    expect(utterance).toMatchObject({ text: 'Hello', lang: 'en-US' })
    expect(utterance.rate).toBeLessThan(1)
  })

  it('does nothing, without throwing, when speech is unavailable', () => {
    Reflect.deleteProperty(window, 'speechSynthesis')
    expect(speechSupported()).toBe(false)
    expect(() => speak('Hello')).not.toThrow()
    expect(() => stopNarration()).not.toThrow()
  })
})

describe('narrate', () => {
  it('uses speech when there is no recorded clip', () => {
    narrate({ text: 'Count the apples' })
    expect((synth.speak.mock.calls[0][0] as FakeUtterance).text).toBe('Count the apples')
  })

  it('plays the recorded clip when provided, and does not also speak', () => {
    const play = vi.fn().mockResolvedValue(undefined)
    const instances: { src: string }[] = []
    class FakeAudio {
      src: string
      constructor(src: string) {
        this.src = src
        instances.push(this)
      }
      addEventListener = vi.fn()
      pause = vi.fn()
      play = play
    }
    vi.stubGlobal('Audio', FakeAudio)
    narrate({ text: 'Count the apples', audio: 'pk/apples.mp3' })
    expect(instances[0].src).toMatch(/audio\/pk\/apples\.mp3$/)
    expect(play).toHaveBeenCalled()
    expect(synth.speak).not.toHaveBeenCalled()
  })

  it('falls back to speech when the clip fails to play', async () => {
    class FakeAudio {
      addEventListener = vi.fn()
      pause = vi.fn()
      play = vi.fn().mockRejectedValue(new Error('blocked'))
    }
    vi.stubGlobal('Audio', FakeAudio)
    narrate({ text: 'Fallback text', audio: 'missing.mp3' })
    await vi.waitFor(() => expect(synth.speak).toHaveBeenCalled())
    expect((synth.speak.mock.calls[0][0] as FakeUtterance).text).toBe('Fallback text')
  })

  it('falls back to speech when the clip file errors', () => {
    let onError: (() => void) | undefined
    class FakeAudio {
      addEventListener = (_: string, fn: () => void) => {
        onError = fn
      }
      pause = vi.fn()
      play = vi.fn().mockResolvedValue(undefined)
    }
    vi.stubGlobal('Audio', FakeAudio)
    narrate({ text: 'Fallback text', audio: 'missing.mp3' })
    expect(synth.speak).not.toHaveBeenCalled()
    onError?.()
    expect(synth.speak).toHaveBeenCalled()
  })
})
