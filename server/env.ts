import path from 'node:path'

export const REPO_ROOT = process.cwd()
export const RUNS_ROOT = path.join(REPO_ROOT, 'runs')
export const PORT = Number(process.env.PORT ?? 8787)

export function getCursorApiKey(): string {
  const key = process.env.CURSOR_API_KEY?.trim()
  if (!key) throw new Error('CURSOR_API_KEY is missing. Add it to .env.')
  return key
}

export function runDir(runId: string): string {
  return path.join(RUNS_ROOT, runId)
}

export function toPublicPath(absolutePath: string): string {
  const relative = path.relative(RUNS_ROOT, absolutePath).split(path.sep).join('/')
  return `/runs/${relative}`
}
