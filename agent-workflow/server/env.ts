import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const serverDir = path.dirname(fileURLToPath(import.meta.url))
export const WORKFLOW_ROOT = path.join(serverDir, '..')
export const REPO_ROOT = path.join(WORKFLOW_ROOT, '..')

dotenv.config({ path: path.join(WORKFLOW_ROOT, '.env') })

export const PORT = Number(process.env.AGENT_WORKFLOW_PORT ?? 3001)

export const ENGINEER_MODEL =
  process.env.AGENT_WORKFLOW_ENGINEER_MODEL?.trim() || 'composer-2.5'

function parseMaxConcurrent(): number {
  const raw = process.env.AGENT_WORKFLOW_MAX_CONCURRENT
  if (raw === undefined || raw === '') return 2
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) {
    console.warn(
      `[agent-workflow] Invalid AGENT_WORKFLOW_MAX_CONCURRENT="${raw}", using 2`,
    )
    return 2
  }
  return Math.floor(n)
}

export const MAX_CONCURRENT_ENGINEER_RUNS = parseMaxConcurrent()

export const READY_SPEC_DIR = path.join(WORKFLOW_ROOT, 'ready-spec')
export const SPECS_IN_PROGRESS_DIR = path.join(WORKFLOW_ROOT, 'specs', 'in-progress')
export const SPECS_DONE_DIR = path.join(WORKFLOW_ROOT, 'specs', 'done')
export const DATA_ROOT = path.join(WORKFLOW_ROOT, 'data')
export const JOBS_DIR = path.join(DATA_ROOT, 'jobs')
export const LOGS_DIR = path.join(DATA_ROOT, 'logs')
export const PERSONAS_DIR = path.join(WORKFLOW_ROOT, 'personas')
export const WORKTREES_DIR = path.join(REPO_ROOT, '.worktrees')

export function getCursorApiKey(): string {
  const key = process.env.CURSOR_API_KEY?.trim()
  if (!key) throw new Error('CURSOR_API_KEY is missing. Add it to agent-workflow/.env.')
  return key
}

export function logPathForJob(jobId: string): string {
  return path.join(LOGS_DIR, `${jobId}.log`)
}
