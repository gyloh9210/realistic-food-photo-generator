import { afterEach, describe, expect, it, vi } from 'vitest'

const { execFileAsync } = vi.hoisted(() => ({
  execFileAsync: vi.fn(),
}))

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}))

vi.mock('node:util', () => ({
  promisify: () => execFileAsync,
}))

const { WORKTREE_START_REF, createWorktreeForSlug, worktreePathForSlug } = await import('./worktrees.js')

describe('createWorktreeForSlug', () => {
  afterEach(() => {
    execFileAsync.mockReset()
  })

  it('fetches origin/main then creates a worktree from that ref', async () => {
    execFileAsync.mockImplementation(async (cmd: string, args: string[]) => {
      if (cmd === 'git' && args[0] === 'worktree' && args[1] === 'list') {
        return { stdout: '', stderr: '' }
      }
      return { stdout: '', stderr: '' }
    })

    const slug = 'my-feature'
    const path = await createWorktreeForSlug(slug)

    expect(path).toBe(worktreePathForSlug(slug))
    expect(execFileAsync).toHaveBeenCalledWith('git', ['fetch', 'origin', 'main'], expect.any(Object))
    expect(execFileAsync).toHaveBeenCalledWith(
      'git',
      ['worktree', 'add', path, '-b', 'feature/my-feature', WORKTREE_START_REF],
      expect.any(Object),
    )
  })

  it('reuses an existing worktree without fetching', async () => {
    const existingPath = worktreePathForSlug('existing')
    execFileAsync.mockImplementation(async (cmd: string, args: string[]) => {
      if (cmd === 'git' && args[0] === 'worktree' && args[1] === 'list') {
        return {
          stdout: `worktree ${existingPath}\nbranch refs/heads/feature/existing\n\n`,
          stderr: '',
        }
      }
      return { stdout: '', stderr: '' }
    })

    const path = await createWorktreeForSlug('existing')

    expect(path).toBe(existingPath)
    expect(execFileAsync).toHaveBeenCalledTimes(1)
    expect(execFileAsync).not.toHaveBeenCalledWith('git', ['fetch', 'origin', 'main'], expect.any(Object))
  })
})
