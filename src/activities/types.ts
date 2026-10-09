import type { Activity } from '../content/schema.ts'

/** Called once when the child has finished an activity. `attempts` counts every answer or placement tried. */
export type ActivityProps<P> = {
  activity: Activity
  payload: P
  onSolved: (result: { attempts: number }) => void
}
