import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { GitSummary } from '../../shared/types.js'

const execFileAsync = promisify(execFile)

export async function getGitSummary(worktreePath: string): Promise<GitSummary | undefined> {
  try {
    const { stdout: branchOut } = await execFileAsync(
      'git',
      ['branch', '--show-current'],
      { cwd: worktreePath },
    )
    const branch = branchOut.trim() || 'unknown'

    const { stdout: statusOut } = await execFileAsync(
      'git',
      ['status', '--porcelain'],
      { cwd: worktreePath },
    )
    const dirty = statusOut.trim().length > 0

    let ahead: number | undefined
    let behind: number | undefined
    try {
      const { stdout: ab } = await execFileAsync(
        'git',
        ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'],
        { cwd: worktreePath },
      )
      const [behindStr, aheadStr] = ab.trim().split(/\s+/)
      behind = Number(behindStr)
      ahead = Number(aheadStr)
      if (!Number.isFinite(ahead)) ahead = undefined
      if (!Number.isFinite(behind)) behind = undefined
    } catch {
      // no upstream
    }

    return { branch, dirty, ahead, behind }
  } catch {
    return undefined
  }
}
