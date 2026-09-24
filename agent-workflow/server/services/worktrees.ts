import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { REPO_ROOT, WORKTREES_DIR } from '../env.js'
import { branchForSlug } from '../../shared/slug.js'

const execFileAsync = promisify(execFile)

/** Start ref for new feature worktrees (must match PR base `main`). */
export const WORKTREE_START_REF = 'origin/main'

export async function fetchOriginMain(): Promise<void> {
  await execFileAsync('git', ['fetch', 'origin', 'main'], { cwd: REPO_ROOT })
}

export function worktreePathForSlug(slug: string): string {
  return path.join(WORKTREES_DIR, slug)
}

export type WorktreeEntry = {
  path: string
  branch: string
  head?: string
}

export async function listWorktrees(): Promise<WorktreeEntry[]> {
  const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
    cwd: REPO_ROOT,
  })
  const entries: WorktreeEntry[] = []
  const blocks = stdout.trim().split(/\n\n+/).filter(Boolean)
  for (const block of blocks) {
    const lines = block.split('\n')
    let wtPath = ''
    let branch = ''
    let head = ''
    for (const line of lines) {
      if (line.startsWith('worktree ')) wtPath = line.slice('worktree '.length)
      if (line.startsWith('branch ')) branch = line.slice('branch '.length).replace(/^refs\/heads\//, '')
      if (line.startsWith('HEAD ')) head = line.slice('HEAD '.length)
    }
    if (wtPath) entries.push({ path: wtPath, branch, head })
  }
  return entries
}

export async function createWorktreeForSlug(slug: string): Promise<string> {
  const target = worktreePathForSlug(slug)
  const branch = branchForSlug(slug)
  const existing = await listWorktrees()
  const hit = existing.find((e) => e.path === target || e.branch === branch)
  if (hit) return hit.path

  await fetchOriginMain()
  await execFileAsync(
    'git',
    ['worktree', 'add', target, '-b', branch, WORKTREE_START_REF],
    { cwd: REPO_ROOT },
  )
  return target
}
