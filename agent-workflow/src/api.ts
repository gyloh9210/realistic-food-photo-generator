import type { JobWithGit, WorkflowConfig } from '../shared/types.js'

export type JobDetail = JobWithGit & { specContent: string }

export async function fetchConfig(): Promise<WorkflowConfig> {
  const res = await fetch('/api/config')
  if (!res.ok) throw new Error('Failed to load config')
  return res.json() as Promise<WorkflowConfig>
}

export async function fetchJobs(): Promise<JobWithGit[]> {
  const res = await fetch('/api/jobs')
  if (!res.ok) throw new Error('Failed to load jobs')
  return res.json() as Promise<JobWithGit[]>
}

export async function fetchJob(id: string): Promise<JobDetail> {
  const res = await fetch(`/api/jobs/${id}`)
  if (!res.ok) throw new Error('Job not found')
  return res.json() as Promise<JobDetail>
}

export async function fetchJobLog(id: string, tail = 200): Promise<string> {
  const res = await fetch(`/api/jobs/${id}/log?tail=${tail}`)
  if (!res.ok) throw new Error('Failed to load log')
  return res.text()
}

export async function fetchReadySpec(): Promise<string[]> {
  const res = await fetch('/api/ready-spec')
  if (!res.ok) return []
  const body = (await res.json()) as { files: string[] }
  return body.files
}
