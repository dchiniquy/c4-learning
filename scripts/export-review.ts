import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { GRADES, type Grade } from '../src/content/schema.ts'
import { renderReviewHtml } from '../src/content/review.ts'
import { readContent } from './read-content.ts'

// usage: npm run export-review -- [grade] [unit]   e.g.  npm run export-review -- prek pk-unit-1
const [gradeArg = 'prek', unit = 'pk-unit-1'] = process.argv.slice(2)
if (!GRADES.includes(gradeArg as Grade)) {
  console.error(`Unknown grade "${gradeArg}". Use one of: ${GRADES.join(', ')}`)
  process.exit(1)
}
const grade = gradeArg as Grade

const { bundle, errors } = readContent()
if (errors.length) {
  console.error(`Content has ${errors.length} validation error(s); run npm run validate-content first.`)
  process.exit(1)
}
if (!bundle.lessons.some((l) => l.grade === grade && l.unit === unit)) {
  console.error(`No lessons found for grade "${grade}", unit "${unit}".`)
  process.exit(1)
}

const outDir = join(import.meta.dirname, '..', 'review')
mkdirSync(outDir, { recursive: true })
const file = join(outDir, `${grade}-${unit}.html`)
writeFileSync(file, renderReviewHtml(bundle, { grade, unit, title: `Review: ${grade} ${unit}` }))
console.log(`Wrote ${file}`)
