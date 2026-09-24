import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { JobDetail as JobDetailType } from '../api.js'
import { fetchJob, fetchJobLog } from '../api.js'

export function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const [job, setJob] = useState<JobDetailType | null>(null)
  const [log, setLog] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    const load = async () => {
      try {
        const [j, l] = await Promise.all([fetchJob(id), fetchJobLog(id, 300)])
        if (!cancelled) {
          setJob(j)
          setLog(l)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed')
      }
    }

    void load()
    const interval = job?.status === 'running' ? 2000 : 5000
    const t = setInterval(() => void load(), interval)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [id, job?.status])

  if (!id) return null
  if (error) return <p className="error">{error}</p>
  if (!job) return <p className="muted">Loading…</p>

  return (
    <div className="page">
      <p><Link to="/">← All jobs</Link></p>
      <header className="header">
        <h1>{job.title}</h1>
        <p className="muted">
          <span className={`status status-${job.status}`}>{job.status}</span>
          {' · '}
          {job.specStage}
          {' · '}
          <code>{job.branch}</code>
        </p>
      </header>

      <section className="panel">
        <h2>Worktree</h2>
        <p><code>{job.worktreePath}</code></p>
        {job.git && (
          <p className="muted">
            Git: {job.git.branch}
            {job.git.dirty ? ' (dirty)' : ' (clean)'}
          </p>
        )}
        {job.error && <p className="error">{job.error}</p>}
      </section>

      <section className="panel">
        <h2>Spec</h2>
        <p className="muted small">{job.specPath}</p>
        <pre className="spec-preview">{job.specContent}</pre>
      </section>

      <section className="panel">
        <h2>Log</h2>
        <pre className="log-preview">{log || '(empty)'}</pre>
      </section>

      <section className="panel muted">
        <p>Start / stop / retry — Phase 2</p>
      </section>
    </div>
  )
}
