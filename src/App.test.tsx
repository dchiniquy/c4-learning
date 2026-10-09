import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { loadContentBundle } from './content/load.ts'
import { newStores } from './test/helpers.ts'

const content = loadContentBundle()

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

type Stores = ReturnType<typeof newStores>

function mount(stores: Stores, route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App store={stores.app} content={content} />
    </MemoryRouter>,
  )
}

function setup(route = '/') {
  const stores = newStores()
  mount(stores, route)
  return { ...stores, user: userEvent.setup(), remount: (to: string) => mount(stores, to) }
}

async function createPin(user: ReturnType<typeof userEvent.setup>, pin = '1234') {
  await user.type(await screen.findByLabelText('PIN'), pin)
  await user.type(screen.getByLabelText('Confirm PIN'), pin)
  await user.click(screen.getByRole('button', { name: 'Save PIN' }))
}

describe('profiles and parent area', () => {
  it('shows an empty state on first run', async () => {
    setup()
    expect(await screen.findByText(/No learners yet/)).toBeInTheDocument()
  })

  it('walks through PIN setup, adding a learner, and opening their page', async () => {
    const { user } = setup('/parent')
    await createPin(user)
    expect(await screen.findByRole('heading', { name: 'Add a learner' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Name'), 'Ada')
    await user.selectOptions(screen.getByLabelText('Level'), 'k')
    await user.click(screen.getByRole('button', { name: 'Add learner' }))
    expect(await screen.findByText(/Ada, Kindergarten/)).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Done' }))
    await user.click(await screen.findByRole('link', { name: /Ada/ }))
    expect(await screen.findByRole('heading', { name: /Hi, Ada!/ })).toBeInTheDocument()
  })

  it('rejects mismatched PINs during setup', async () => {
    const { user } = setup('/parent')
    await user.type(await screen.findByLabelText('PIN'), '1234')
    await user.type(screen.getByLabelText('Confirm PIN'), '4321')
    await user.click(screen.getByRole('button', { name: 'Save PIN' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('do not match')
  })

  it('asks for the PIN on later visits and re-locks when a child page opens', async () => {
    const { user, app } = setup('/parent')
    await createPin(user)
    await app.getState().addChild({ name: 'Bo', avatar: '🐼', grade: '1' })
    await user.click(await screen.findByRole('button', { name: 'Lock' }))

    await user.type(await screen.findByLabelText('Enter PIN'), '0000')
    await user.click(screen.getByRole('button', { name: 'Unlock' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('not right')

    await user.type(screen.getByLabelText('Enter PIN'), '1234')
    await user.click(screen.getByRole('button', { name: 'Unlock' }))
    expect(await screen.findByRole('heading', { name: 'Add a learner' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Done' }))
    await user.click(await screen.findByRole('link', { name: /Bo/ }))
    await waitFor(() => expect(app.getState().parentUnlocked).toBe(false))
  })

  it('deletes a learner after confirmation', async () => {
    const { user, app } = setup('/parent')
    await createPin(user)
    await app.getState().addChild({ name: 'Cy', avatar: '🐸', grade: '2' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(await screen.findByRole('button', { name: 'Delete Cy' }))
    await waitFor(() => expect(app.getState().children).toEqual([]))
  })

  it('redirects unknown child ids home', async () => {
    setup('/child/does-not-exist')
    expect(await screen.findByRole('heading', { name: 'Who is learning today?' })).toBeInTheDocument()
  })
})

describe("child's Today schedule", () => {
  const MONDAY = new Date(2026, 9, 12, 10, 0)
  const SATURDAY = new Date(2026, 9, 10, 10, 0)

  async function childPage(grade: 'prek' | '1', now: Date) {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(now)
    const ctx = setup('/')
    await ctx.app.getState().load()
    const child = await ctx.app.getState().addChild({ name: 'Ada', avatar: '🦊', grade })
    return { ...ctx, child }
  }

  it("shows the weekday's blocks in time order with the app-time meter", async () => {
    const { user, child } = await childPage('prek', MONDAY)
    await user.click(await screen.findByRole('link', { name: /Ada/ }))
    expect(await screen.findByRole('heading', { name: 'Monday' })).toBeInTheDocument()
    expect(screen.getByText(/App time today: 0 of 20 min \(limit 30 min\)/)).toBeInTheDocument()

    const labels = screen.getAllByRole('checkbox').map((c) => c.closest('label')?.querySelector('strong')?.textContent)
    expect(labels[0]).toBe('Circle time: calendar, weather, song')
    expect(labels).toContain('Number app time')
    expect(labels).toHaveLength(10)
    expect(child.grade).toBe('prek')
  })

  it('shows hands-on instructions for lessons, for the grown-up', async () => {
    const { user } = await childPage('prek', MONDAY)
    await user.click(await screen.findByRole('link', { name: /Ada/ }))
    expect(await screen.findByText(/For the grown-up: Count the beans/)).toBeInTheDocument()
    expect(screen.getByText(/dried beans/)).toBeInTheDocument()
  })

  it('ticking an app block moves the meter, and it persists after a reload', async () => {
    const stores = await childPage('prek', MONDAY)
    await stores.user.click(await screen.findByRole('link', { name: /Ada/ }))
    await stores.user.click(await screen.findByRole('checkbox', { name: /Number app time/ }))
    expect(screen.getByText(/App time today: 10 of 20 min/)).toBeInTheDocument()

    // A hands-on block does not count toward app time.
    await stores.user.click(screen.getByRole('checkbox', { name: /Circle time/ }))
    expect(screen.getByText(/App time today: 10 of 20 min/)).toBeInTheDocument()

    cleanup()
    stores.remount(`/child/${stores.child.id}`)
    expect(await screen.findByRole('checkbox', { name: /Number app time/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Circle time/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Art or craft/ })).not.toBeChecked()

    await stores.user.click(screen.getByRole('checkbox', { name: /Number app time/ }))
    expect(screen.getByText(/App time today: 0 of 20 min/)).toBeInTheDocument()
  })

  it('uses the grade 1 schedule for a grade 1 learner', async () => {
    const { user } = await childPage('1', MONDAY)
    await user.click(await screen.findByRole('link', { name: /Ada/ }))
    expect(await screen.findByText(/App time today: 0 of 30 min \(limit 60 min\)/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Phonics lesson/ })).toBeInTheDocument()
  })

  it('shows a friendly message on days with nothing scheduled', async () => {
    const { user } = await childPage('prek', SATURDAY)
    await user.click(await screen.findByRole('link', { name: /Ada/ }))
    expect(await screen.findByText(/No lessons are scheduled today/)).toBeInTheDocument()
  })

  it('says so when a level has no schedule yet', async () => {
    const stores = newStores()
    await stores.app.getState().load()
    const kid = await stores.app.getState().addChild({ name: 'Kay', avatar: '🐢', grade: 'k' })
    mount(stores, `/child/${kid.id}`)
    expect(await screen.findByText(/No schedule is set up for this level yet/)).toBeInTheDocument()
  })
})

describe('playing a lesson from Today', () => {
  const MONDAY = new Date(2026, 9, 12, 10, 0)

  it('plays the on-screen activities, saves progress, and ticks the block when finished', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(MONDAY)
    const ctx = setup('/')
    await ctx.app.getState().load()
    const child = await ctx.app.getState().addChild({ name: 'Ada', avatar: '🦊', grade: 'prek' })
    const { user } = ctx

    await user.click(await screen.findByRole('link', { name: /Ada/ }))
    await user.click(await screen.findByRole('link', { name: /Start Number app time/ }))
    expect(await screen.findByRole('heading', { name: 'Counting game' })).toBeInTheDocument()
    expect(screen.getByText('Activity 1 of 3')).toBeInTheDocument()

    // Activity 1: count the apples (one wrong answer first).
    await user.click(screen.getByRole('button', { name: '2' }))
    await user.click(screen.getByRole('button', { name: '3' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))

    // Activity 2: count the stars.
    expect(screen.getByText('Activity 2 of 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '5' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))

    // Activity 3: find seven, then finish.
    await user.click(screen.getByRole('button', { name: '7' }))
    await user.click(screen.getByRole('button', { name: 'All done!' }))

    // Back on Today with the block ticked and the meter updated.
    expect(await screen.findByRole('heading', { name: 'Monday' })).toBeInTheDocument()
    expect(await screen.findByRole('checkbox', { name: /Number app time/ })).toBeChecked()
    expect(screen.getByText(/App time today: 10 of 20 min/)).toBeInTheDocument()

    const records = await ctx.progress.getProgress(child.id)
    expect(records.map((r) => r.activityId).sort()).toEqual(['pk-count-apples', 'pk-count-stars', 'pk-find-seven'])
    expect(records.find((r) => r.activityId === 'pk-count-apples')).toMatchObject({ status: 'done', attempts: 2, lessonId: 'pk-numbers-app', lessonVersion: 1 })
  })

  it('adds up attempts across repeat play-throughs', async () => {
    const stores = newStores()
    await stores.app.getState().load()
    const child = await stores.app.getState().addChild({ name: 'Bo', avatar: '🐼', grade: 'prek' })
    const input = { childId: child.id, lessonId: 'l', lessonVersion: 1, activityId: 'a', attempts: 2, timeSpentSec: 10 }
    await stores.app.getState().recordActivity(input)
    await stores.app.getState().recordActivity({ ...input, attempts: 1, timeSpentSec: 5 })
    const [record] = await stores.progress.getProgress(child.id)
    expect(record).toMatchObject({ attempts: 3, timeSpentSec: 15, status: 'done' })
  })

  it('does not offer Start for hands-on blocks, and sends bad lesson links home', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(MONDAY)
    const ctx = setup('/')
    await ctx.app.getState().load()
    await ctx.app.getState().addChild({ name: 'Ada', avatar: '🦊', grade: 'prek' })
    await ctx.user.click(await screen.findByRole('link', { name: /Ada/ }))
    await screen.findByRole('heading', { name: 'Monday' })
    expect(screen.getAllByRole('link', { name: /^Start / })).toHaveLength(2) // the two app-time blocks only
  })

  it('redirects a lesson link with an unknown lesson back to the child page', async () => {
    const stores = newStores()
    await stores.app.getState().load()
    const child = await stores.app.getState().addChild({ name: 'Cy', avatar: '🐸', grade: 'prek' })
    mount(stores, `/child/${child.id}/lesson/nope`)
    expect(await screen.findByRole('heading', { name: /Hi, Cy!/ })).toBeInTheDocument()
  })
})

describe('progress-paced lessons', () => {
  const MONDAY = new Date(2026, 9, 12, 10, 0)
  const TUESDAY = new Date(2026, 9, 13, 10, 0)

  it('advances a hands-on block to the next lesson only after the child finishes one', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(MONDAY)
    const ctx = setup('/')
    await ctx.app.getState().load()
    const child = await ctx.app.getState().addChild({ name: 'Ada', avatar: '🦊', grade: 'prek' })
    const { user } = ctx

    await user.click(await screen.findByRole('link', { name: /Ada/ }))
    expect(await screen.findByText(/For the grown-up: Count the beans/)).toBeInTheDocument()

    // Skipping the day: Tuesday still shows the first lesson.
    cleanup()
    vi.setSystemTime(TUESDAY)
    ctx.remount(`/child/${child.id}`)
    expect(await screen.findByText(/For the grown-up: Count the beans/)).toBeInTheDocument()

    // Finish it on Tuesday: it stays on screen today, and is replaced the next day.
    await user.click(screen.getByRole('checkbox', { name: /Hands-on math/ }))
    expect(screen.getByText(/For the grown-up: Count the beans/)).toBeInTheDocument()
    const [saved] = await ctx.progress.getChecks(child.id, '2026-10-13')
    expect(saved.lessonId).toBe('pk-bean-count')

    cleanup()
    vi.setSystemTime(new Date(2026, 9, 14, 10, 0)) // Wednesday
    ctx.remount(`/child/${child.id}`)
    expect(await screen.findByText(/For the grown-up: Pattern snack/)).toBeInTheDocument()
    expect(screen.queryByText(/For the grown-up: Count the beans/)).not.toBeInTheDocument()
  })

  it('says when a sequence has no lessons left', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(MONDAY)
    const ctx = setup('/')
    await ctx.app.getState().load()
    const child = await ctx.app.getState().addChild({ name: 'Bo', avatar: '🐼', grade: 'prek' })
    for (const lessonId of ['pk-bean-count', 'pk-pattern-snack']) {
      await ctx.progress.setCheck({ childId: child.id, date: '2026-10-01', blockKey: `x:${lessonId}`, lessonId, completedAt: 1 })
    }
    await ctx.user.click(await screen.findByRole('link', { name: /Bo/ }))
    expect(await screen.findByText(/finished all the lessons we have/)).toBeInTheDocument()
  })
})
