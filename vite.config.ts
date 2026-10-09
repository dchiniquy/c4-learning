import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { forGrade } from './src/content/grade.ts'
import { GRADES, type Grade } from './src/content/schema.ts'
import { readContent } from './scripts/read-content.ts'

const PREFIX = 'virtual:c4-content/'

/**
 * Turns content/ into virtual modules: one per grade (loaded on demand), plus the standards and a
 * full bundle (used by tests). Invalid content fails the build, so a broken lesson can't ship.
 */
function contentPlugin(): Plugin {
  return {
    name: 'c4-content',
    resolveId(id) {
      return id.startsWith(PREFIX) ? '\0' + id : undefined
    },
    load(id) {
      if (!id.startsWith('\0' + PREFIX)) return
      const name = id.slice(PREFIX.length + 1)

      const { bundle, errors, files } = readContent()
      if (errors.length) this.error(`Invalid content:\n${errors.map((e) => `  - ${e}`).join('\n')}`)
      for (const file of files) this.addWatchFile(file)

      let data: unknown
      if (name === 'all') data = bundle
      else if (name === 'standards') data = bundle.standards
      else if (name.startsWith('grade-') && GRADES.includes(name.slice('grade-'.length) as Grade)) {
        data = forGrade(bundle, name.slice('grade-'.length) as Grade)
      } else this.error(`Unknown content module "${name}"`)

      return `export default ${JSON.stringify(data)}`
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), contentPlugin()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
