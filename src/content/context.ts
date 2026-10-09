import { createContext, useContext } from 'react'
import type { ContentBundle } from './schema.ts'

export const ContentContext = createContext<ContentBundle | null>(null)

export function useContent(): ContentBundle {
  const content = useContext(ContentContext)
  if (!content) throw new Error('useContent must be used inside <ContentContext.Provider>')
  return content
}
