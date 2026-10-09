# c4-learning

A homeschool learning web app for ages 4 to 8 (pre-K through grade 3). Short, audio-first app lessons sit alongside a full daily schedule of offline, hands-on activities, since screens are only a small part of the day for young children.

| Age | Level |
|---|---|
| 4 | Pre-K |
| 5 | Kindergarten |
| 6 | Grade 1 |
| 7 | Grade 2 |
| 8 | Grade 3 |

Aligned to Common Core (ELA, Math), NGSS, C3 (social studies) and CASEL (SEL); pre-K uses Head Start ELOF and the Texas Pre-K Guidelines as references.

## Status

Early build: learner profiles, a PIN-gated parent area with backup/restore and a progress report, a picture-based child home ("next up" card and day strip) plus a grown-up plan with screen-time meter, audio-first on-screen activities (tap-to-hear, multiple choice, sort, ten-frame, number line), and progress-paced lesson sequences. Content is being written level by level, starting with pre-K.

## Develop

```bash
npm install
npm run dev               # dev server
npm test                  # unit tests (vitest)
npm run typecheck
npm run lint
npm run validate-content  # validate everything under content/
npm run e2e               # browser smoke tests (Playwright; first run: npx playwright install chromium)
npm run build
```

## Content

Lessons, skills, standards and schedules are JSON files under `content/`, validated by Zod schemas in `src/content/schema.ts` plus cross-reference checks in `src/content/validate.ts`.

- `standards/` published standards (CCSS Math and Reading Foundations K-3, NGSS K-3, plus Texas Pre-K). Set `verified: true` only after checking the code and wording against `source`. Lessons that depend on an unverified standard fail validation.
- `skills/` skills linked to standards. Progress is tracked per skill and reported by standard.
- `lessons/` lessons with their activities. Offline, parent-led activities are first-class, with materials and parent prompts.
- `sequences/` ordered lessons for a subject. A schedule block can point at a sequence and shows the first lesson the child hasn't finished, so lessons advance with progress, not the calendar. Blocks can also point at one fixed lesson (e.g. a repeatable game).
- `schedules/` daily schedule templates per grade, checked against a per-grade screen-time budget.

How content reaches the app: a build plugin (`vite.config.ts`) reads `content/`, validates it (an invalid lesson fails the build), and serves one chunk per grade plus a separate standards chunk. The app loads only the grade a child is on; the standards load only on the parent's progress report. `npm run export-review -- <grade> <unit>` writes a readable, printable page of a unit to `review/` (git-ignored).

## Privacy

Progress is stored only in the browser (IndexedDB). There are no accounts and no third-party analytics. Adding sync or going public later needs a COPPA review first.
