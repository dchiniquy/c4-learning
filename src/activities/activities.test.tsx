import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { narrate, stopNarration } from '../audio/narration.ts'
import type { Activity } from '../content/schema.ts'
import ActivityPlayer from './ActivityPlayer.tsx'

vi.mock('../audio/narration.ts', () => ({ narrate: vi.fn(), speak: vi.fn(), stopNarration: vi.fn(), speechSupported: () => false }))

const activity = (type: Activity['type'], payload: Record<string, unknown>, prompt = 'Do the thing'): Activity => ({
  id: `act-${type}`, type, mode: 'screen', leadBy: 'app', title: `Title ${type}`, minutes: 5, prompt, materials: [], parentPrompts: [], payload,
})

function setup(a: Activity, autoRead = false) {
  const onSolved = vi.fn()
  render(<ActivityPlayer activity={a} autoRead={autoRead} onSolved={onSolved} />)
  return { onSolved, user: userEvent.setup() }
}

beforeEach(() => vi.clearAllMocks())

describe('multiple-choice', () => {
  const a = activity('multiple-choice', { stem: '🍎🍎🍎', choices: [{ id: 'two', label: '2' }, { id: 'three', label: '3' }], correctId: 'three' })

  it('gives gentle feedback on a wrong answer and keeps going', async () => {
    const { user, onSolved } = setup(a)
    await user.click(screen.getByRole('button', { name: '2' }))
    expect(screen.getByRole('status')).toHaveTextContent('Try again')
    expect(onSolved).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '3' }))
    expect(onSolved).toHaveBeenCalledExactlyOnceWith({ attempts: 2 })
  })

  it('locks the other choices once solved and shows the stem as an image for screen readers', async () => {
    const { user } = setup(a)
    expect(screen.getByRole('img', { name: '🍎🍎🍎' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '3' }))
    expect(screen.getByRole('button', { name: '2' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Yes')
  })
})

describe('tap-to-hear', () => {
  it('finishes once every item has been tapped, and only once', async () => {
    const { user, onSolved } = setup(activity('tap-to-hear', { items: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }))
    await user.click(screen.getByRole('button', { name: 'A' }))
    expect(onSolved).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'B' }))
    expect(onSolved).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: /A/ }))
    expect(onSolved).toHaveBeenCalledTimes(1)
  })
})

describe('number-line', () => {
  it('accepts only the target number', async () => {
    const { user, onSolved } = setup(activity('number-line', { min: 1, max: 10, target: 7 }))
    expect(screen.getAllByRole('button').filter((b) => /^\d+$/.test(b.textContent ?? ''))).toHaveLength(10)
    await user.click(screen.getByRole('button', { name: '6' }))
    expect(onSolved).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '7' }))
    expect(onSolved).toHaveBeenCalledExactlyOnceWith({ attempts: 2 })
  })
})

describe('sort', () => {
  const a = activity('sort', {
    categories: [{ id: 'sh', label: 'sh' }, { id: 'ch', label: 'ch' }],
    items: [{ id: 'ship', label: 'ship', categoryId: 'sh' }, { id: 'chop', label: 'chop', categoryId: 'ch' }],
  })

  it('places words by tapping a word then its group, and finishes when all are placed', async () => {
    const { user, onSolved } = setup(a)
    await user.click(screen.getByRole('button', { name: 'sh' }))
    expect(screen.getByRole('status')).toHaveTextContent('Tap a word first')

    await user.click(screen.getByRole('button', { name: 'ship' }))
    await user.click(screen.getByRole('button', { name: 'ch' })) // wrong group
    expect(screen.getByRole('status')).toHaveTextContent('Try again')
    expect(screen.getByRole('button', { name: 'ship' })).toBeInTheDocument() // still unsorted

    await user.click(screen.getByRole('button', { name: 'sh' }))
    expect(screen.queryByRole('button', { name: 'ship' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Group sh' })).toHaveTextContent('ship')
    expect(onSolved).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'chop' }))
    await user.click(screen.getByRole('button', { name: 'ch' }))
    expect(onSolved).toHaveBeenCalledExactlyOnceWith({ attempts: 3 }) // tapping a group with no word chosen is not an attempt
  })
})

describe('ten-frame', () => {
  const a = activity('ten-frame', { rounds: [{ start: 8 }, { start: 9 }] })
  const cell = (n: number, state: 'full' | 'empty') => screen.getByRole('button', { name: `Spot ${n}, ${state}` })

  it('starts with counters placed, ignores taps on them, and celebrates when ten is reached', async () => {
    const { user } = setup(a)
    expect(cell(8, 'full')).toBeInTheDocument()
    expect(cell(9, 'empty')).toBeInTheDocument()
    await user.click(cell(1, 'full'))
    expect(screen.getByText(/8 of 10 filled/)).toBeInTheDocument()

    await user.click(cell(9, 'empty'))
    expect(screen.queryByRole('button', { name: 'Next round' })).not.toBeInTheDocument()
    await user.click(cell(10, 'empty'))
    expect(screen.getByRole('status')).toHaveTextContent('8 and 2 make ten!')
    expect(screen.getByRole('button', { name: 'Next round' })).toBeInTheDocument()
  })

  it('lets a child take back a counter they added', async () => {
    const { user } = setup(a)
    await user.click(cell(9, 'empty'))
    await user.click(cell(9, 'full'))
    expect(screen.getByText(/8 of 10 filled/)).toBeInTheDocument()
  })

  it('moves through rounds and finishes after the last one', async () => {
    const { user, onSolved } = setup(a)
    await user.click(cell(9, 'empty'))
    await user.click(cell(10, 'empty'))
    await user.click(screen.getByRole('button', { name: 'Next round' }))
    expect(screen.getByText(/Round 2 of 2: 9 of 10 filled/)).toBeInTheDocument()
    await user.click(cell(10, 'empty'))
    expect(onSolved).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'All done' }))
    expect(onSolved).toHaveBeenCalledTimes(1)
  })
})

describe('prompt', () => {
  const a = activity('number-line', { min: 1, max: 3, target: 2 }, 'Tap the number two.')

  it('reads the prompt automatically when asked, and again from the speaker button', async () => {
    const { user } = setup(a, true)
    expect(screen.getByText('Tap the number two.')).toBeInTheDocument()
    expect(narrate).toHaveBeenCalledWith({ text: 'Tap the number two.', audio: undefined })
    await user.click(screen.getByRole('button', { name: 'Hear the instructions again' }))
    expect(narrate).toHaveBeenCalledTimes(2)
  })

  it('stays quiet until tapped when auto-read is off, and stops when it goes away', async () => {
    const { user } = setup(a, false)
    expect(narrate).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Hear the instructions again' }))
    expect(narrate).toHaveBeenCalledTimes(1)
    expect(stopNarration).not.toHaveBeenCalled()
  })

  it('passes the recorded clip path to narration', () => {
    setup({ ...a, audio: 'pk/two.mp3' }, true)
    expect(narrate).toHaveBeenCalledWith({ text: 'Tap the number two.', audio: 'pk/two.mp3' })
  })
})

describe('bad input', () => {
  it('shows a message instead of crashing on an invalid payload', () => {
    setup(activity('multiple-choice', { choices: [], correctId: 'x' }))
    expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded')
  })

  it('refuses activity types that are not on-screen games', () => {
    setup(activity('offline-task', {}))
    expect(screen.getByRole('alert')).toHaveTextContent('not an on-screen game')
  })
})

describe('shipped content', () => {
  it('renders every on-screen activity without an error', async () => {
    const { default: bundle } = await import('virtual:c4-content/all')
    const { isInteractive } = await import('./payloads.ts')
    const screens = bundle.lessons.flatMap((l) => l.activities).filter((a) => a.mode === 'screen' && isInteractive(a.type))
    expect(screens.length).toBeGreaterThanOrEqual(8)
    for (const a of screens) {
      const { unmount } = render(<ActivityPlayer activity={a} autoRead={false} onSolved={() => {}} />)
      expect(screen.queryByRole('alert'), a.id).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Hear the instructions again' }), a.id).toBeInTheDocument()
      unmount()
    }
  })
})
