import path from 'node:path'

export const REPO_ROOT = process.cwd()
export const RUNS_ROOT = path.join(REPO_ROOT, 'runs')
export const PORT = Number(process.env.PORT ?? 8787)

export function getCursorApiKey(): string {
  const key = process.env.CURSOR_API_KEY?.trim()
  if (!key) throw new Error('CURSOR_API_KEY is missing. Add it to .env.')
  return key
}
