import type { ReactNode } from 'react'
import type { z } from 'zod'
import type { Activity } from '../content/schema.ts'
import MultipleChoice from './MultipleChoice.tsx'
import NumberLine from './NumberLine.tsx'
import PromptBar from './PromptBar.tsx'
import Sort from './Sort.tsx'
import TapToHear from './TapToHear.tsx'
import TenFrame from './TenFrame.tsx'
import {
  MultipleChoicePayload,
  NumberLinePayload,
  SortPayload,
  TapToHearPayload,
  TenFramePayload,
} from './payloads.ts'

type Solved = (result: { attempts: number }) => void

/** Validates the payload for one activity type, then hands the typed result to `children`. */
function Parsed<S extends z.ZodType>({ schema, payload, children }: { schema: S; payload: unknown; children: (p: z.infer<S>) => ReactNode }) {
  const parsed = schema.safeParse(payload)
  if (!parsed.success) return <p role="alert">This activity could not be loaded.</p>
  return <>{children(parsed.data)}</>
}

/** Renders one interactive screen activity with its spoken prompt. */
export default function ActivityPlayer({ activity, autoRead, onSolved }: { activity: Activity; autoRead: boolean; onSolved: Solved }) {
  const common = { activity, onSolved }
  const p = activity.payload

  let body: ReactNode
  switch (activity.type) {
    case 'tap-to-hear':
      body = <Parsed schema={TapToHearPayload} payload={p}>{(x) => <TapToHear {...common} payload={x} />}</Parsed>
      break
    case 'multiple-choice':
      body = <Parsed schema={MultipleChoicePayload} payload={p}>{(x) => <MultipleChoice {...common} payload={x} />}</Parsed>
      break
    case 'sort':
      body = <Parsed schema={SortPayload} payload={p}>{(x) => <Sort {...common} payload={x} />}</Parsed>
      break
    case 'ten-frame':
      body = <Parsed schema={TenFramePayload} payload={p}>{(x) => <TenFrame {...common} payload={x} />}</Parsed>
      break
    case 'number-line':
      body = <Parsed schema={NumberLinePayload} payload={p}>{(x) => <NumberLine {...common} payload={x} />}</Parsed>
      break
    default:
      return <p role="alert">This activity is not an on-screen game.</p>
  }

  return (
    <section aria-label={activity.title}>
      <PromptBar activity={activity} autoRead={autoRead} />
      {body}
    </section>
  )
}
