import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import * as cursorAgent from './cursorAgent.js'
import { generateFoodImage } from './generateImage.js'

vi.mock('./cursorAgent.js', async () => {
  const actual = await vi.importActual<typeof import('./cursorAgent.js')>('./cursorAgent.js')
  return { ...actual, runCursorAgent: vi.fn() }
})

describe('generateFoodImage', () => {
  it('waits for the output file the agent is instructed to write', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'generate-image-'))
    try {
      const outputPath = path.join(dir, 'attempt-0.png')
      vi.mocked(cursorAgent.runCursorAgent).mockImplementation(async () => {
        await writeFile(outputPath, 'fake-png-bytes')
      })

      await generateFoodImage({ apiKey: 'k', generationPrompt: 'a very detailed prompt', outputPath })

      const task = vi.mocked(cursorAgent.runCursorAgent).mock.calls[0][0].task
      expect(task).toContain('a very detailed prompt')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('propagates an error if the agent never produces the file', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'generate-image-'))
    try {
      const outputPath = path.join(dir, 'never-written.png')
      vi.mocked(cursorAgent.runCursorAgent).mockResolvedValue(undefined)

      await expect(
        generateFoodImage({ apiKey: 'k', generationPrompt: 'x', outputPath, timeoutMs: 200 }),
      ).rejects.toThrow('Timed out waiting for file')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
