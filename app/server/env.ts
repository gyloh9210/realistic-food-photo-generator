import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const serverDir = path.dirname(fileURLToPath(import.meta.url))
export const APP_ROOT = path.join(serverDir, '..')

dotenv.config({ path: path.join(APP_ROOT, '.env') })

/** App package root (run `npm` commands from `app/`). */
export const REPO_ROOT = APP_ROOT
export const RUNS_ROOT = path.join(REPO_ROOT, 'runs')
export const PORT = Number(process.env.PORT ?? 8787)
export const CURSOR_MODEL = process.env.CURSOR_MODEL?.trim() || 'composer-2.5'

export function getCursorApiKey(): string {
  const key = process.env.CURSOR_API_KEY?.trim()
  if (!key) throw new Error('CURSOR_API_KEY is missing. Add it to app/.env.')
  return key
}

export function runDir(runId: string): string {
  return path.join(RUNS_ROOT, runId)
}

/**
 * URL prefix the Express app serves RUNS_ROOT files under. Deliberately NOT
 * `/runs`, which is the frontend SPA route for a run page — sharing that
 * prefix makes the Vite dev proxy swallow `/runs/:runId` navigations.
 */
export const RUN_FILES_URL_PREFIX = '/run-files'

export function toPublicPath(absolutePath: string): string {
  const relative = path.relative(RUNS_ROOT, absolutePath).split(path.sep).join('/')
  return `${RUN_FILES_URL_PREFIX}/${relative}`
}
