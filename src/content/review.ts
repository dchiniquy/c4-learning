import { SUBJECT_LABEL } from './labels.ts'
import { SUBJECTS, type ContentBundle, type Grade, type Lesson } from './schema.ts'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export type ReviewOptions = { grade: Grade; unit: string; title: string }

/**
 * A single readable, printable page of one unit: lessons grouped by week and subject, each with its
 * standards, materials and steps. For reviewing content (and printing plans), not for the app itself.
 */
export function renderReviewHtml(bundle: ContentBundle, { grade, unit, title }: ReviewOptions): string {
  const standards = new Map(bundle.standards.map((s) => [s.id, s]))
  const skills = new Map(bundle.skills.map((s) => [s.id, s]))

  // Lessons appear in the order a child meets them: by position in their sequence, else file order.
  const order = new Map<string, number>()
  for (const seq of bundle.sequences) seq.lessonIds.forEach((id, i) => order.set(id, i))
  const lessons = bundle.lessons
    .filter((l) => l.grade === grade && l.unit === unit)
    .sort((a, b) => (a.week ?? 99) - (b.week ?? 99) || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))

  const standardUse = new Map<string, number>()
  const lessonStandards = (l: Lesson) => [...new Set(l.skillIds.flatMap((id) => skills.get(id)?.standardIds ?? []))]
  for (const l of lessons) for (const id of lessonStandards(l)) standardUse.set(id, (standardUse.get(id) ?? 0) + 1)

  const renderLesson = (l: Lesson) => {
    const stds = lessonStandards(l).map((id) => standards.get(id)).filter((s) => !!s)
    const skillNames = l.skillIds.map((id) => skills.get(id)?.name ?? id)
    return `
    <article class="lesson">
      <h4>${esc(l.title)} <span class="meta">${esc(SUBJECT_LABEL[l.subject])} · ${l.activities.reduce((n, a) => n + a.minutes, 0)} min</span></h4>
      <p class="skills"><strong>Skills:</strong> ${skillNames.map(esc).join('; ')}</p>
      <p class="standards"><strong>Standards:</strong> ${
        stds.length ? stds.map((s) => `<span title="${esc(s.description)}">${esc(s.code)}</span>`).join(', ') : '<em>none linked</em>'
      }</p>
      ${l.activities
        .map(
          (a) => `<section class="activity">
        <h5>${esc(a.title)} <span class="meta">${a.mode === 'screen' ? 'on screen' : 'hands-on'}</span></h5>
        ${a.prompt ? `<p><strong>Spoken prompt:</strong> ${esc(a.prompt)}</p>` : ''}
        ${a.materials.length ? `<p><strong>Materials:</strong> ${a.materials.map(esc).join('; ')}</p>` : ''}
        ${a.parentPrompts.length ? `<ol>${a.parentPrompts.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>` : ''}
      </section>`,
        )
        .join('')}
    </article>`
  }

  const weeks = [...new Set(lessons.map((l) => l.week))]
  const body = weeks
    .map((week) => {
      const inWeek = lessons.filter((l) => l.week === week)
      const sections = SUBJECTS.map((subject) => ({ subject, items: inWeek.filter((l) => l.subject === subject) })).filter((s) => s.items.length)
      return `<section class="week"><h2>${week ? `Week ${week}` : 'Other lessons'}</h2>${sections
        .map((s) => `<h3>${esc(SUBJECT_LABEL[s.subject])}</h3>${s.items.map(renderLesson).join('')}`)
        .join('')}</section>`
    })
    .join('')

  const coverage = [...standardUse.entries()]
    .map(([id, n]) => ({ s: standards.get(id)!, n }))
    .filter((x) => x.s)
    .sort((a, b) => a.s.code.localeCompare(b.s.code, undefined, { numeric: true }))
  const coverageRows = coverage.map(({ s, n }) => `<tr><td>${esc(s.code)}</td><td>${esc(s.description)}</td><td>${n}</td></tr>`).join('')

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; max-width: 52rem; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
  h1 { margin-bottom: 0.25rem } h2 { margin-top: 2.5rem; border-bottom: 2px solid #333; page-break-before: always }
  h2:first-of-type { page-break-before: auto } h3 { margin-top: 1.5rem; color: #333 }
  .lesson { border: 1px solid #ccc; border-radius: 8px; padding: 0.5rem 1rem; margin: 1rem 0; break-inside: avoid }
  .meta { font-weight: normal; font-size: 0.8em; color: #555 } .skills, .standards { margin: 0.25rem 0; font-size: 0.9em }
  .standards span { border-bottom: 1px dotted #555; cursor: help } h4, h5 { margin: 0.5rem 0 0.25rem }
  table { border-collapse: collapse; width: 100% } td, th { border: 1px solid #ccc; padding: 0.25rem 0.5rem; text-align: left; vertical-align: top; font-size: 0.9em }
  @media (prefers-color-scheme: dark) { body { background: #111; color: #eee } .lesson, td, th { border-color: #555 } h3 { color: #ccc } }
</style></head><body>
<h1>${esc(title)}</h1>
<p>${lessons.length} lessons across ${weeks.length} week${weeks.length === 1 ? '' : 's'}. Hover a standard code to see its wording.</p>
${body}
<h2>Standards covered</h2>
<table><thead><tr><th>Code</th><th>Standard</th><th>Lessons</th></tr></thead><tbody>${coverageRows}</tbody></table>
</body></html>
`
}
