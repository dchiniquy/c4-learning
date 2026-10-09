import type { ReactNode } from 'react'
import { useApp } from '../../store/appStore.ts'
import { EnterPin, SetupPin } from './PinForms.tsx'
import ParentHome from './ParentHome.tsx'

/** Wraps parent-only screens: the first visit sets a PIN, later visits ask for it. */
export function ParentGate({ children }: { children: ReactNode }) {
  const ready = useApp((s) => s.ready)
  const hasPin = useApp((s) => s.pin !== undefined)
  const unlocked = useApp((s) => s.parentUnlocked)

  if (!ready) return <p role="status">Loading…</p>
  if (!hasPin) return <SetupPin />
  if (!unlocked) return <EnterPin />
  return <>{children}</>
}

export default function ParentArea() {
  return (
    <ParentGate>
      <ParentHome />
    </ParentGate>
  )
}
