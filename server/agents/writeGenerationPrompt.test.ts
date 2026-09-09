import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import * as cursorAgent from './cursorAgent.js'
import { writeGenerationPrompt } from './writeGenerationPrompt.js'

vi.mock('./cursorAgent.js', async () => {
  const actual = await vi.importActual<typeof import('./cursorAgent.js')>('./cursorAgent.js')
  return { ...actual, runCursorAgent: vi.fn() }
})

describe('writeGenerationPrompt', () => {
  it('reads back the prompt file the agent is instructed to write', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'write-prompt-'))
    try {
      const outputPath = path.join(dir, 'prompt.txt')
      vi.mocked(cursorAgent.runCursorAgent).mockImplementation(async () => {
        await writeFile(outputPath, 'a very detailed prompt\n')
      })

      const result = await writeGenerationPrompt({
        apiKey: 'k',
        prompt: 'nasi lemak with fried chicken',
        approvedImages: [{ id: 'a', sourceUrl: 'https://x/a.jpg', localPath: path.join(dir, 'a.jpg'), status: 'approved' }],
        outputPath,
      })

      expect(result).toBe('a very detailed prompt')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('includes the rejection reason in the task text on a retry', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'write-prompt-'))
    try {
      const outputPath = path.join(dir, 'prompt.txt')
      vi.mocked(cursorAgent.runCursorAgent).mockImplementation(async () => {
        await writeFile(outputPath, 'a fixed prompt')
      })

      await writeGenerationPrompt({
        apiKey: 'k',
        prompt: 'nasi lemak',
        approvedImages: [],
        finalRejectReason: 'too glossy',
        outputPath,
      })

      const task = vi.mocked(cursorAgent.runCursorAgent).mock.calls[0][0].task
      expect(task).toContain('too glossy')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
