import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App.tsx'
import { narrate } from '../../audio/narration.ts'
import { eagerSource } from '../../content/source.ts'
import { fixtureWithSchedule } from '../../test/fixtures.ts'
import { newStores } from '../../test/helpers.ts'

vi.mock('../../audio/narration.ts', () => ({ narrate: vi.fn(), speak: vi.fn(), stopNarration: vi.fn(), speechSupported: () => false }))

const MONDAY = new Date(2026, 9, 12, 10, 0)
const SATURDAY = new Date(2026, 9, 10, 10, 0)

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.useRealTimers())

async function setup(grade: 'k' | '1' = 'k', now = MONDAY) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
  const stores = newStores()
  await stores.app.getState().load()
  const child = await stores.app.getState().addChild({ name: 'Ada', avatar: '🦊', grade })
  const view = () =>
    render(
      <MemoryRouter initialEntries={[`/child/${child.id}`]}>
        <App store={stores.app} content={eagerSource(fixtureWithSchedule())} />
      </MemoryRouter>,
    )
  return { ...stores, child, view, user: userEvent.setup() }
}

describe("child's home", () => {
  it('shows one big next-up card and a picture strip, with no times or limits', async () => {
    const { view } = await setup()
    view()
    expect(await screen.findByRole('heading', { name: 'Circle time' })).toBeInTheDocument()
    expect(screen.getByText('Next up')).toBeInTheDocument()
    expect(screen.getByText('Ask your grown-up to help you.')).toBeInTheDocument()
    expect(screen.getByText(/0 of 3 done/)).toBeInTheDocument()

    const strip = screen.getByRole('list', { name: 'Your day in pictures' })
    expect(within(strip).getAllByRole('listitem').map((li) => li.getAttribute('aria-label'))).toEqual([
      'Circle time: to do, next',
      'Number game: to do',
      'Reading time: to do',
    ])
    expect(screen.queryByText(/limit|min\b/i)).not.toBeInTheDocument()
  })

  it('moves to the next block when a hands-on block is done, and keeps it after a reload', async () => {
    const { view, user, progress, child } = await setup()
    view()
    await user.click(await screen.findByRole('button', { name: 'I did it!' }))

    expect(await screen.findByRole('heading', { name: 'Number game' })).toBeInTheDocument()
    expect(screen.getByText(/1 of 3 done/)).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'Circle time: done' })).toBeInTheDocument()
    expect(await progress.getChecks(child.id, '2026-10-12')).toHaveLength(1)

    cleanup() // a fresh visit reads the saved progress
    view()
    expect(await screen.findByRole('heading', { name: 'Number game' })).toBeInTheDocument()
    expect(screen.getByText(/1 of 3 done/)).toBeInTheDocument()
  })

  it('offers "Let\'s play!" for an app game and "I did it!" for the rest', async () => {
    const { view, progress, child } = await setup()
    await progress.setCheck({ childId: child.id, date: '2026-10-12', blockKey: 'k-fixture:1:09:00', completedAt: 1 })
    view()
    const play = await screen.findByRole('link', { name: "Let's play!" })
    expect(play).toHaveAttribute('href', `/child/${child.id}/lesson/gm1?block=${encodeURIComponent('k-fixture:1:09:10')}`)
    expect(screen.queryByRole('button', { name: 'I did it!' })).not.toBeInTheDocument()
  })

  it('shows the grown-up steps for a lesson under the card', async () => {
    const { view, progress, child } = await setup()
    for (const key of ['k-fixture:1:09:00', 'k-fixture:1:09:10']) await progress.setCheck({ childId: child.id, date: '2026-10-12', blockKey: key, completedAt: 1 })
    view()
    expect(await screen.findByRole('heading', { name: 'Reading time' })).toBeInTheDocument()
    expect(screen.getByText('For the grown-up: Lesson r1')).toBeInTheDocument()
  })

  it('celebrates when everything is done', async () => {
    const { view, progress, child } = await setup()
    for (const key of ['k-fixture:1:09:00', 'k-fixture:1:09:10', 'k-fixture:1:09:20']) {
      await progress.setCheck({ childId: child.id, date: '2026-10-12', blockKey: key, completedAt: 1 })
    }
    view()
    expect(await screen.findByRole('heading', { name: 'All done for today!' })).toBeInTheDocument()
    expect(screen.getByText('Great job, Ada!')).toBeInTheDocument()
    expect(screen.getByText(/3 of 3 done/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'I did it!' })).not.toBeInTheDocument()
  })

  it('says so on a day with nothing scheduled', async () => {
    const { view } = await setup('k', SATURDAY)
    view()
    expect(await screen.findByText(/No lessons today/)).toBeInTheDocument()
  })

  it('links to the grown-up plan', async () => {
    const { view, user } = await setup()
    view()
    await user.click(await screen.findByRole('link', { name: 'Grown-up plan' }))
    expect(await screen.findByRole('heading', { name: /plan for the grown-up/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Monday' })).toBeInTheDocument()
    expect(screen.getByText(/App time today: 0 of 10 min/)).toBeInTheDocument()
  })
})

describe('reading the next card aloud', () => {
  it('reads it automatically for kindergarten, and again from the speaker button', async () => {
    const { view, user } = await setup('k')
    view()
    await screen.findByRole('heading', { name: 'Circle time' })
    expect(narrate).toHaveBeenCalledWith({ text: 'Next up: Circle time' })
    await user.click(screen.getByRole('button', { name: 'Hear what is next' }))
    expect(narrate).toHaveBeenCalledTimes(2)
  })

  it('waits to be tapped for older learners', async () => {
    const { view, user } = await setup('1')
    view()
    await screen.findByRole('heading', { name: 'Circle time' })
    expect(narrate).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Hear what is next' }))
    expect(narrate).toHaveBeenCalledWith({ text: 'Next up: Circle time' })
  })
})
