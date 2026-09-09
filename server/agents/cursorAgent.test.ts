import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Agent } from '@cursor/sdk'
import { runCursorAgent, toRepoRelative, waitForFile } from './cursorAgent.js'

vi.mock('@cursor/sdk', () => ({
  Agent: { create: vi.fn() },
}))

describe('runCursorAgent', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sends the combined system prompt and task, then disposes the agent', async () => {
    const send = vi.fn().mockResolvedValue({ wait: () => Promise.resolve({ status: 'completed', id: 'r1' }) })
    const dispose = vi.fn().mockResolvedValue(undefined)
    vi.mocked(Agent.create).mockResolvedValue({ send, close: vi.fn(), [Symbol.asyncDispose]: dispose } as never)

    await runCursorAgent({ apiKey: 'k', systemPrompt: 'sys', task: 'do it' })

    expect(send).toHaveBeenCalledWith('sys\n\n---\n\ndo it')
    expect(dispose).toHaveBeenCalled()
  })

  it('throws when the run status is error', async () => {
    const send = vi.fn().mockResolvedValue({ wait: () => Promise.resolve({ status: 'error', id: 'r2' }) })
    vi.mocked(Agent.create).mockResolvedValue({
      send,
      close: vi.fn(),
      [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
    } as never)

    await expect(runCursorAgent({ apiKey: 'k', systemPrompt: 'sys', task: 'do it' })).rejects.toThrow(
      'Cursor agent run failed (r2)',
    )
  })

  it('disposes the agent even when send() throws', async () => {
    const dispose = vi.fn().mockResolvedValue(undefined)
    vi.mocked(Agent.create).mockResolvedValue({
      send: vi.fn().mockRejectedValue(new Error('network down')),
      close: vi.fn(),
      [Symbol.asyncDispose]: dispose,
    } as never)

    await expect(runCursorAgent({ apiKey: 'k', systemPrompt: 'sys', task: 'do it' })).rejects.toThrow('network down')
    expect(dispose).toHaveBeenCalled()
  })

  it('times out if the run never resolves', async () => {
    const send = vi.fn().mockResolvedValue({ wait: () => new Promise(() => {}) })
    vi.mocked(Agent.create).mockResolvedValue({
      send,
      close: vi.fn(),
      [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
    } as never)

    await expect(
      runCursorAgent({ apiKey: 'k', systemPrompt: 'sys', task: 'do it', timeoutMs: 50 }),
    ).rejects.toThrow('timed out')
  })
})

describe('waitForFile', () => {
  it('resolves once the file appears', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'cursor-agent-test-'))
    const target = path.join(dir, 'out.txt')
    setTimeout(() => {
      void writeFile(target, 'done')
    }, 100)

    await expect(waitForFile(target, 2_000)).resolves.toBeUndefined()
    await rm(dir, { recursive: true, force: true })
  })

  it('rejects if the file never appears within the timeout', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'cursor-agent-test-'))
    const target = path.join(dir, 'missing.txt')
    await expect(waitForFile(target, 300)).rejects.toThrow('Timed out waiting for file')
    await rm(dir, { recursive: true, force: true })
  })
})

describe('toRepoRelative', () => {
  it('returns a path relative to the repo root', () => {
    const abs = path.join(process.cwd(), 'runs', 'abc', 'references', 'a.jpg')
    expect(toRepoRelative(abs)).toBe(path.join('runs', 'abc', 'references', 'a.jpg'))
  })
})
