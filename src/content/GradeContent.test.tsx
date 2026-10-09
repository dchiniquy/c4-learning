import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useContent } from './context.ts'
import GradeContent, { ContentSourceProvider } from './GradeContent.tsx'
import { eagerSource, type ContentSource } from './source.ts'
import { fixtureContent } from '../test/fixtures.ts'

function Count() {
  const c = useContent()
  return <p>{`${c.lessons.length} lessons, ${c.standards.length} standards`}</p>
}

const view = (source: ContentSource, props: { grade: 'k' | '1'; withStandards?: boolean }) =>
  render(
    <ContentSourceProvider value={source}>
      <GradeContent {...props}>
        <Count />
      </GradeContent>
    </ContentSourceProvider>,
  )

describe('GradeContent', () => {
  it('shows loading, then provides that grade only', async () => {
    view(eagerSource(fixtureContent()), { grade: 'k' })
    expect(screen.getByRole('status')).toHaveTextContent('Loading lessons')
    expect(await screen.findByText('4 lessons, 0 standards')).toBeInTheDocument()
  })

  it('loads the standards only when asked', async () => {
    const source = eagerSource(fixtureContent())
    const loadStandards = vi.spyOn(source, 'loadStandards')
    view(source, { grade: '1', withStandards: true })
    expect(await screen.findByText('1 lessons, 3 standards')).toBeInTheDocument()
    expect(loadStandards).toHaveBeenCalledTimes(1)
  })

  it('does not load standards by default', async () => {
    const source = eagerSource(fixtureContent())
    const loadStandards = vi.spyOn(source, 'loadStandards')
    view(source, { grade: 'k' })
    await screen.findByText(/4 lessons/)
    expect(loadStandards).not.toHaveBeenCalled()
  })

  it('shows a friendly message when loading fails', async () => {
    const source: ContentSource = { loadGrade: () => Promise.reject(new Error('offline')), loadStandards: async () => [] }
    view(source, { grade: 'k' })
    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't load the lessons")
  })

  it('reloads when the grade changes', async () => {
    const source = eagerSource(fixtureContent())
    const { rerender } = view(source, { grade: 'k' })
    await screen.findByText(/4 lessons/)
    rerender(
      <ContentSourceProvider value={source}>
        <GradeContent grade="1">
          <Count />
        </GradeContent>
      </ContentSourceProvider>,
    )
    expect(await screen.findByText(/^1 lessons/)).toBeInTheDocument()
  })
})
