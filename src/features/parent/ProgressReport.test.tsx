import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../App.tsx'
import { eagerSource } from '../../content/source.ts'
import { fixtureContent } from '../../test/fixtures.ts'
import { newStores } from '../../test/helpers.ts'

afterEach(() => vi.useRealTimers())

async function setup(bundle = fixtureContent()) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 12, 10, 0))
  const stores = newStores()
  await stores.app.getState().load()
  await stores.app.getState().setupPin('1234') // leaves the parent area unlocked
  const child = await stores.app.getState().addChild({ name: 'Ada', avatar: '🦊', grade: 'k' })
  await stores.progress.setCheck({ childId: child.id, date: '2026-10-12', blockKey: 'b1', lessonId: 'c1', completedAt: 1 })
  await stores.progress.setCheck({ childId: child.id, date: '2026-10-09', blockKey: 'b2', lessonId: 'r1', completedAt: 1 })
  const view = (route: string) =>
    render(
      <MemoryRouter initialEntries={[route]}>
        <App store={stores.app} content={eagerSource(bundle)} />
      </MemoryRouter>,
    )
  return { ...stores, child, view, user: userEvent.setup() }
}

describe('progress report', () => {
  it('summarizes lessons, recent days, and skills for the child', async () => {
    const { child, view } = await setup()
    view(`/parent/progress/${child.id}`)
    expect(await screen.findByRole('heading', { name: /Ada: progress/ })).toBeInTheDocument()
    expect(screen.getByText('Kindergarten · as of 2026-10-12')).toBeInTheDocument()

    const lessons = screen.getByText('Lessons done').closest('div')!
    expect(within(lessons).getByText('2 of 4')).toBeInTheDocument()
    expect(screen.getByText('Standards worked on').closest('div')).toHaveTextContent('1 of 2')

    expect(screen.getByText(/2026-10-12: Lesson c1/)).toBeInTheDocument()
    expect(screen.getByText(/2026-10-09: Lesson r1/)).toBeInTheDocument()

    const math = screen.getByRole('region', { name: /Math/ })
    const row = within(math).getByRole('row', { name: /Counting/ })
    expect(within(row).getByText('1 of 2')).toBeInTheDocument()
    expect(within(row).getByText('K.CC.A.1')).toHaveAttribute('title', 'Wording of K.CC.A.1')
  })

  it('lets a parent mark a skill and put it back to automatic, saving each change', async () => {
    const { child, view, user, progress } = await setup()
    view(`/parent/progress/${child.id}`)
    const select = await screen.findByLabelText('Level for Counting')
    expect(select).toHaveValue('')
    expect(within(select).getByRole('option', { name: 'Automatic (Practicing)' })).toBeInTheDocument()

    await user.selectOptions(select, 'mastered')
    expect(screen.getByLabelText('Level for Counting')).toHaveValue('mastered')
    expect(await progress.getMastery(child.id)).toMatchObject([{ skillId: 'sk-count', level: 'mastered' }])

    await user.selectOptions(screen.getByLabelText('Level for Counting'), '')
    expect(await progress.getMastery(child.id)).toEqual([])
  })

  it('leaves out the lesson count for a subject whose skills are taught inside other subjects', async () => {
    const bundle = fixtureContent()
    bundle.skills.push({ id: 'sk-sel', subject: 'sel', name: 'Feelings', prerequisites: [], standardIds: [] })
    bundle.lessons[0].skillIds.push('sk-sel') // a math lesson that also teaches a feelings skill
    const { child, view } = await setup(bundle)
    view(`/parent/progress/${child.id}`)

    const sel = await screen.findByRole('region', { name: /Social-emotional/ })
    expect(within(sel).getByRole('heading', { name: 'Social-emotional' })).toBeInTheDocument()
    expect(within(sel).queryByText(/lessons/)).not.toBeInTheDocument()
    expect(within(sel).getByText('Feelings')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: /Math/ })).getByText('1 of 3 lessons')).toBeInTheDocument()
  })

  it('says so when nothing was finished recently, and shows untouched skills as not started', async () => {
    const stores = await setup()
    await stores.progress.deleteChild(stores.child.id)
    const other = await stores.app.getState().addChild({ name: 'Bo', avatar: '🐼', grade: 'k' })
    stores.view(`/parent/progress/${other.id}`)
    expect(await screen.findByText('Nothing finished in the last 7 days.')).toBeInTheDocument()
    const select = screen.getByLabelText('Level for Reading words')
    expect(select).toHaveValue('')
    expect(within(select).getByRole('option', { name: 'Automatic (Not started)' })).toBeInTheDocument()
  })

  it('asks for the PIN when locked, and sends unknown children back to the parent area', async () => {
    const { child, view, app } = await setup()
    app.getState().lock()
    view(`/parent/progress/${child.id}`)
    expect(await screen.findByLabelText('Enter PIN')).toBeInTheDocument()
  })

  it('redirects an unknown child to the parent area', async () => {
    const { view } = await setup()
    view('/parent/progress/nobody')
    expect(await screen.findByRole('heading', { name: 'Add a learner' })).toBeInTheDocument()
  })

  it('is reachable from the parent area', async () => {
    const { view, user } = await setup()
    view('/parent')
    await user.click(await screen.findByRole('link', { name: "View Ada's progress" }))
    expect(await screen.findByRole('heading', { name: /Ada: progress/ })).toBeInTheDocument()
  })
})
