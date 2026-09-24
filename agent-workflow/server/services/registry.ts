import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { FeatureJob, JobStatus } from '../../shared/types.js'
import { JOBS_DIR } from '../env.js'

async function ensureJobsDir(): Promise<void> {
  await mkdir(JOBS_DIR, { recursive: true })
}

function jobPath(id: string): string {
  return path.join(JOBS_DIR, `${id}.json`)
}

export async function saveJob(job: FeatureJob): Promise<void> {
  await ensureJobsDir()
  await writeFile(jobPath(job.id), JSON.stringify(job, null, 2) + '\n', 'utf8')
}

export async function getJob(id: string): Promise<FeatureJob | null> {
  try {
    const raw = await readFile(jobPath(id), 'utf8')
    return JSON.parse(raw) as FeatureJob
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

export async function listJobs(): Promise<FeatureJob[]> {
  await ensureJobsDir()
  let names: string[]
  try {
    names = await readdir(JOBS_DIR)
  } catch {
    return []
  }
  const jobs: FeatureJob[] = []
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    const id = name.replace(/\.json$/, '')
    const job = await getJob(id)
    if (job) jobs.push(job)
  }
  jobs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return jobs
}

export async function hasActiveJob(id: string): Promise<boolean> {
  const job = await getJob(id)
  if (!job) return false
  return job.status === 'queued' || job.status === 'running'
}

export function nowIso(): string {
  return new Date().toISOString()
}

export async function updateJob(
  id: string,
  patch: Partial<FeatureJob>,
): Promise<FeatureJob> {
  const existing = await getJob(id)
  if (!existing) throw new Error(`Job not found: ${id}`)
  const next: FeatureJob = {
    ...existing,
    ...patch,
    id: existing.id,
    updatedAt: nowIso(),
  }
  await saveJob(next)
  return next
}

export async function createJob(job: Omit<FeatureJob, 'updatedAt'>): Promise<FeatureJob> {
  const full: FeatureJob = { ...job, updatedAt: nowIso() }
  await saveJob(full)
  return full
}

export function isTerminalStatus(status: JobStatus): boolean {
  return status === 'done' || status === 'failed' || status === 'stopped'
}
