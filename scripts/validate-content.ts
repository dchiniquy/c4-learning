import { readContent } from './read-content.ts'

const { bundle, errors } = readContent()

if (errors.length) {
  console.error(`Content validation failed (${errors.length}):\n` + errors.map((e) => `  - ${e}`).join('\n'))
  process.exit(1)
}
console.log(
  `Content OK: ${bundle.standards.length} standards, ${bundle.skills.length} skills, ` +
    `${bundle.lessons.length} lessons, ${bundle.sequences.length} sequences, ${bundle.schedules.length} schedules`,
)
