import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { LOCKOUT_MS, useApp } from '../../store/appStore.ts'
import { PIN_PATTERN } from '../../store/pin.ts'

const PIN_HINT = 'Use 4 to 6 digits.'

export function SetupPin() {
  const setupPin = useApp((s) => s.setupPin)
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!PIN_PATTERN.test(pin)) return setError(PIN_HINT)
    if (pin !== confirm) return setError('The PINs do not match.')
    await setupPin(pin)
  }

  return (
    <section>
      <h1>Set up the parent area</h1>
      <p>Choose a PIN so only a grown-up can change settings. {PIN_HINT}</p>
      <form onSubmit={submit}>
        <label>
          PIN
          <input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} />
        </label>
        <label>
          Confirm PIN
          <input type="password" inputMode="numeric" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Save PIN</button>
      </form>
      <p>
        <Link to="/">Back</Link>
      </p>
    </section>
  )
}

export function EnterPin() {
  const unlock = useApp((s) => s.unlock)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const result = await unlock(pin)
    setPin('')
    if (result === 'wrong') setError('That PIN is not right.')
    if (result === 'locked') setError(`Too many tries. Wait ${LOCKOUT_MS / 1000} seconds and try again.`)
  }

  return (
    <section>
      <h1>Parent area</h1>
      <form onSubmit={submit}>
        <label>
          Enter PIN
          <input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Unlock</button>
      </form>
      <p>
        <Link to="/">Back</Link>
      </p>
    </section>
  )
}
