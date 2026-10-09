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

Early build: learner profiles, a PIN-gated parent area, local progress storage with backup/restore, a daily schedule with screen-time meter, and audio-first on-screen activities (tap-to-hear, multiple choice, sort, ten-frame, number line). Sample content covers pre-K and grade 1 only.

## Develop

```bash
npm install
npm run dev               # dev server
npm test                  # unit tests (vitest)
npm run typecheck
npm run lint
npm run validate-content  # validate everything under content/
npm run build
```

## Content

Lessons, skills, standards and schedules are JSON files under `content/`, validated by Zod schemas in `src/content/schema.ts` plus cross-reference checks in `src/content/validate.ts`.

- `standards/` published standards. Set `verified: true` only after checking the code and wording against `source`. Lessons that depend on an unverified standard fail validation.
- `skills/` skills linked to standards. Progress is tracked per skill and reported by standard.
- `lessons/` lessons with their activities. Offline, parent-led activities are first-class, with materials and parent prompts.
- `schedules/` daily schedule templates per grade, checked against a per-grade screen-time budget.

## Privacy

Progress is stored only in the browser (IndexedDB). There are no accounts and no third-party analytics. Adding sync or going public later needs a COPPA review first.
