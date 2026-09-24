import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { JobWithGit, WorkflowConfig } from '../../shared/types.js'
import { fetchConfig, fetchJobs, fetchReadySpec } from '../api.js'

function statusClass(status: string): string {
  return `status status-${status}`
}

export function Dashboard() {
  const [jobs, setJobs] = useState<JobWithGit[]>([])
  const [inbox, setInbox] = useState<string[]>([])
  const [config, setConfig] = useState<WorkflowConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [j, c, r] = await Promise.all([fetchJobs(), fetchConfig(), fetchReadySpec()])
        if (!cancelled) {
          setJobs(j)
          setConfig(c)
          setInbox(r)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed')
      }
    }
    void load()
    const t = setInterval(() => void load(), 4000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  return (
    <div className="page">
      <header className="header">
        <h1>Agent workflow</h1>
        {config && (
          <p className="muted">
            Model: {config.engineerModel} · Max parallel: {config.maxConcurrent}
          </p>
        )}
      </header>

      {error && <p className="error">{error}</p>}

      <section className="panel">
        <h2>Ready spec inbox</h2>
        {inbox.length === 0 ? (
          <p className="muted">No files in ready-spec/</p>
        ) : (
          <ul>
            {inbox.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Jobs</h2>
        {jobs.length === 0 ? (
          <p className="muted">Drop a .md file into agent-workflow/ready-spec/ to start.</p>
        ) : (
          <table className="jobs-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Status</th>
                <th>Stage</th>
                <th>Branch</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <Link to={`/jobs/${job.id}`}>{job.title}</Link>
                    <div className="muted small">{job.id}</div>
                  </td>
                  <td><span className={statusClass(job.status)}>{job.status}</span></td>
                  <td>{job.specStage}</td>
                  <td><code>{job.branch}</code></td>
                  <td className="muted small">{new Date(job.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
