import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { GRADES, GRADE_AGE, type Grade } from '../../content/schema.ts'
import { useApp } from '../../store/appStore.ts'
import { backupFilename, parseBackup } from '../../store/backup.ts'
import { AVATARS } from '../../store/types.ts'

const GRADE_LABEL: Record<Grade, string> = { prek: 'Pre-K', k: 'Kindergarten', '1': 'Grade 1', '2': 'Grade 2', '3': 'Grade 3' }

function AddChildForm() {
  const addChild = useApp((s) => s.addChild)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState<string>(AVATARS[0])
  const [grade, setGrade] = useState<Grade>('prek')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await addChild({ name, avatar, grade })
    setName('')
  }

  return (
    <form onSubmit={submit}>
      <h2>Add a learner</h2>
      <label>
        Name
        <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Avatar
        <select value={avatar} onChange={(e) => setAvatar(e.target.value)}>
          {AVATARS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <label>
        Level
        <select value={grade} onChange={(e) => setGrade(e.target.value as Grade)}>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {GRADE_LABEL[g]} (age {GRADE_AGE[g]})
            </option>
          ))}
        </select>
      </label>
      <button type="submit">Add learner</button>
    </form>
  )
}

function Backup() {
  const exportData = useApp((s) => s.exportData)
  const importData = useApp((s) => s.importData)
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')

  async function download() {
    const data = await exportData()
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = backupFilename()
    a.click()
    URL.revokeObjectURL(url)
  }

  async function restore(file: File) {
    const result = parseBackup(await file.text())
    if (!result.ok) return setMessage(result.error)
    const n = result.data.children.length
    if (!window.confirm(`Replace everything with this backup (${n} learner${n === 1 ? '' : 's'})? Current data will be lost.`)) return
    await importData(result.data)
    setMessage('Backup restored.')
  }

  return (
    <section>
      <h2>Backup</h2>
      <p>Progress is saved only in this browser. Download a backup to keep it safe or move it to another device.</p>
      <button type="button" onClick={download}>
        Download backup
      </button>
      <label>
        Restore from backup
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file) await restore(file)
            if (fileRef.current) fileRef.current.value = ''
          }}
        />
      </label>
      {message && <p role="status">{message}</p>}
    </section>
  )
}

export default function ParentHome() {
  const children = useApp((s) => s.children)
  const deleteChild = useApp((s) => s.deleteChild)
  const lock = useApp((s) => s.lock)

  return (
    <section>
      <h1>Parent area</h1>
      <h2>Learners</h2>
      {children.length === 0 ? (
        <p>No learners yet.</p>
      ) : (
        <ul>
          {children.map((c) => (
            <li key={c.id}>
              <span aria-hidden="true">{c.avatar} </span>
              {c.name}, {GRADE_LABEL[c.grade]}{' '}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete ${c.name} and all their progress? This cannot be undone.`)) void deleteChild(c.id)
                }}
              >
                Delete {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <AddChildForm />
      <Backup />
      <p>
        <button type="button" onClick={lock}>
          Lock
        </button>{' '}
        <Link to="/">Done</Link>
      </p>
    </section>
  )
}
