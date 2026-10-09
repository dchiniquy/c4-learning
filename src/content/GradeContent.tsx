import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ContentContext } from './context.ts'
import type { Grade, ContentBundle } from './schema.ts'
import type { ContentSource } from './source.ts'

const SourceContext = createContext<ContentSource | null>(null)
export const ContentSourceProvider = SourceContext.Provider

type State = { key: string; bundle: ContentBundle } | { key: string; failed: true }

/** Loads one grade's content (and the standards, if asked) and makes it available to everything inside. */
export default function GradeContent({ grade, withStandards = false, children }: { grade: Grade; withStandards?: boolean; children: ReactNode }) {
  const source = useContext(SourceContext)
  if (!source) throw new Error('GradeContent must be used inside <ContentSourceProvider>')

  const key = `${grade}|${withStandards}`
  const [state, setState] = useState<State | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([source.loadGrade(grade), withStandards ? source.loadStandards() : Promise.resolve([])])
      .then(([content, standards]) => {
        if (!cancelled) setState({ key, bundle: { ...content, standards } })
      })
      .catch(() => {
        if (!cancelled) setState({ key, failed: true })
      })
    return () => {
      cancelled = true
    }
  }, [source, grade, withStandards, key])

  if (!state || state.key !== key) return <p role="status">Loading lessons…</p>
  if ('failed' in state) return <p role="alert">We couldn't load the lessons. Check your connection and reload the page.</p>
  return <ContentContext.Provider value={state.bundle}>{children}</ContentContext.Provider>
}
