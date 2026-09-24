import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import * as cursorAgent from './cursorAgent.js'
import { screenReferenceImages } from './screenReferences.js'

vi.mock('./cursorAgent.js', async () => {
  const actual = await vi.importActual<typeof import('./cursorAgent.js')>('./cursorAgent.js')
  return { ...actual, runCursorAgent: vi.fn() }
})

describe('screenReferenceImages', () => {
  it('returns {} without calling the agent when there is nothing to screen', async () => {
    const result = await screenReferenceImages({ apiKey: 'k', prompt: 'nasi lemak', images: [], notesPath: '/tmp/notes.json' })
    expect(result).toEqual({})
    expect(cursorAgent.runCursorAgent).not.toHaveBeenCalled()
  })

  it('reads back the notes file the agent is instructed to write', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'screen-refs-'))
    try {
      const notesPath = path.join(dir, 'notes.json')
      vi.mocked(cursorAgent.runCursorAgent).mockImplementation(async () => {
        await writeFile(notesPath, JSON.stringify({ a: 'looks real' }))
      })

      const result = await screenReferenceImages({
        apiKey: 'k',
        prompt: 'nasi lemak',
        images: [{ id: 'a', sourceUrl: 'https://x/a.jpg', localPath: path.join(dir, 'a.jpg'), status: 'pending' }],
        notesPath,
      })

      expect(result).toEqual({ a: 'looks real' })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
