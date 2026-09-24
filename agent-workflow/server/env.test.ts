import { afterEach, describe, expect, it, vi } from 'vitest'

describe('env max concurrent parsing', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('defaults to 2 when unset', async () => {
    vi.stubEnv('AGENT_WORKFLOW_MAX_CONCURRENT', '')
    const { MAX_CONCURRENT_ENGINEER_RUNS } = await import('./env.js')
    expect(MAX_CONCURRENT_ENGINEER_RUNS).toBe(2)
  })

  it('uses valid integer', async () => {
    vi.stubEnv('AGENT_WORKFLOW_MAX_CONCURRENT', '3')
    vi.resetModules()
    const { MAX_CONCURRENT_ENGINEER_RUNS } = await import('./env.js')
    expect(MAX_CONCURRENT_ENGINEER_RUNS).toBe(3)
  })
})
