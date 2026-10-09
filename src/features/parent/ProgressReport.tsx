import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useContent } from '../../content/context.ts'
import GradeContent from '../../content/GradeContent.tsx'
import { GRADE_LABEL, SUBJECT_LABEL } from '../../content/labels.ts'
import { localDateString } from '../../schedule/engine.ts'
import { LEVEL_LABEL, summarizeProgress, type SkillLevel, type SkillProgress } from '../../progress/summary.ts'
import { useApp } from '../../store/appStore.ts'
import type { Child, ScheduleCheck, SkillMastery } from '../../store/types.ts'

const MARK_OPTIONS: SkillLevel[] = ['practicing', 'proficient', 'mastered']

function SkillRow({ row, onMark }: { row: SkillProgress; onMark: (level: SkillLevel | null) => void }) {
  return (
    <tr>
      <td>{row.skill.name}</td>
      <td>
        {row.standards.length
          ? row.standards.map((s, i) => (
              <span key={s.id}>
                {i > 0 && ', '}
                <abbr title={s.description}>{s.code.replace(/^CCSS\.(Math\.Content|ELA-Literacy)\./, '')}</abbr>
              </span>
            ))
          : '—'}
      </td>
      <td>
        {row.lessonsDone} of {row.lessonsTotal}
      </td>
      <td>
        <label>
          <span className="sr-only">Level for {row.skill.name}</span>
          <select
            value={row.marked ? row.level : ''}
            onChange={(e) => onMark(e.target.value === '' ? null : (e.target.value as SkillLevel))}
          >
            <option value="">Automatic ({LEVEL_LABEL[row.lessonsDone > 0 ? 'practicing' : 'not-started']})</option>
            {MARK_OPTIONS.map((level) => (
              <option key={level} value={level}>
                {LEVEL_LABEL[level]}
              </option>
            ))}
          </select>
        </label>
      </td>
    </tr>
  )
}

export default function ProgressReport() {
  const { childId } = useParams()
  const ready = useApp((s) => s.ready)
  const child = useApp((s) => s.children.find((c) => c.id === childId))

  if (!ready) return <p role="status">Loading…</p>
  if (!child) return <Navigate to="/parent" replace />
  return (
    <GradeContent grade={child.grade} withStandards>
      <Report child={child} />
    </GradeContent>
  )
}

function Report({ child }: { child: Child }) {
  const childId = child.id
  const content = useContent()
  const loadAllChecks = useApp((s) => s.loadAllChecks)
  const loadMastery = useApp((s) => s.loadMastery)
  const setMastery = useApp((s) => s.setMastery)

  const [today] = useState(() => localDateString(new Date()))
  const [loaded, setLoaded] = useState<{ childId: string; checks: ScheduleCheck[]; marks: SkillMastery[] } | null>(null)
  const data = loaded?.childId === childId ? loaded : null

  useEffect(() => {
    let cancelled = false
    void Promise.all([loadAllChecks(childId), loadMastery(childId)]).then(([checks, marks]) => {
      if (!cancelled) setLoaded({ childId, checks, marks })
    })
    return () => {
      cancelled = true
    }
  }, [childId, loadAllChecks, loadMastery])

  const summary = useMemo(
    () => (data ? summarizeProgress(content, child.grade, data.checks, data.marks, today) : null),
    [content, child.grade, data, today],
  )

  if (!summary) return <p role="status">Loading progress…</p>

  async function mark(skillId: string, level: SkillLevel | null) {
    await setMastery(child.id, skillId, level)
    setLoaded((prev) => {
      if (!prev) return prev
      const rest = prev.marks.filter((m) => m.skillId !== skillId)
      return { ...prev, marks: level ? [...rest, { childId: child.id, skillId, level }] : rest }
    })
  }

  return (
    <section className="report">
      <p className="no-print">
        <Link to="/parent">Back to parent area</Link>
      </p>
      <h1>
        <span aria-hidden="true">{child.avatar} </span>
        {child.name}: progress
      </h1>
      <p>
        {GRADE_LABEL[child.grade]} · as of {today}
      </p>

      <dl className="summary">
        <div>
          <dt>Lessons done</dt>
          <dd>
            {summary.lessonsDone} of {summary.lessonsTotal}
          </dd>
        </div>
        <div>
          <dt>Days active</dt>
          <dd>{summary.daysActive}</dd>
        </div>
        <div>
          <dt>Standards worked on</dt>
          <dd>
            {summary.standardsWorkedOn} of {summary.standardsAvailable}
          </dd>
        </div>
      </dl>

      <h2>Last 7 days</h2>
      {summary.recent.length === 0 ? (
        <p>Nothing finished in the last 7 days.</p>
      ) : (
        <ul>
          {summary.recent.map((r) => (
            <li key={`${r.date}-${r.lesson.id}`}>
              {r.date}: {r.lesson.title} <span className="meta">({SUBJECT_LABEL[r.lesson.subject]})</span>
            </li>
          ))}
        </ul>
      )}

      {summary.bySubject.map((subject) => (
        <section key={subject.subject} aria-labelledby={`subject-${subject.subject}`}>
          <h2 id={`subject-${subject.subject}`}>
            {SUBJECT_LABEL[subject.subject]}{' '}
            <span className="meta">
              {subject.lessonsDone} of {subject.lessonsTotal} lessons
            </span>
          </h2>
          {subject.skills.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Skill</th>
                  <th>Standards</th>
                  <th>Lessons</th>
                  <th>Level</th>
                </tr>
              </thead>
              <tbody>
                {subject.skills.map((row) => (
                  <SkillRow key={row.skill.id} row={row} onMark={(level) => void mark(row.skill.id, level)} />
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}

      <p className="note">
        "Practicing" is worked out from lessons finished. "Doing well" and "Got it" are your call: the app doesn't score {child.name}.
      </p>
      <p className="no-print">
        <button type="button" onClick={() => window.print()}>
          Print this report
        </button>
      </p>
    </section>
  )
}
