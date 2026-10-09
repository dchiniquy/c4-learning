import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { newStores } from './test/helpers.ts'

afterEach(() => vi.restoreAllMocks())

function setup(route = '/') {
  const stores = newStores()
  render(
    <MemoryRouter initialEntries={[route]}>
      <App store={stores.app} />
    </MemoryRouter>,
  )
  return { ...stores, user: userEvent.setup() }
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
