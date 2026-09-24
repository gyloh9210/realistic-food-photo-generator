import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('registry', () => {
  let tempRoot: string

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'aw-registry-'))
    vi.resetModules()
    vi.doMock('../env.js', () => ({
      JOBS_DIR: path.join(tempRoot, 'jobs'),
    }))
  })

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true })
    vi.doUnmock('../env.js')
  })

  it('creates and lists jobs', async () => {
    const { createJob, getJob, listJobs } = await import('./registry.js')
    await createJob({
      id: 'test-feature',
      title: 'Test',
      specPath: '/tmp/spec.md',
      specStage: 'in-progress',
      branch: 'feature/test-feature',
      worktreePath: '/tmp/wt',
      status: 'queued',
    })
    const one = await getJob('test-feature')
    expect(one?.title).toBe('Test')
    const all = await listJobs()
    expect(all).toHaveLength(1)
  })
})
