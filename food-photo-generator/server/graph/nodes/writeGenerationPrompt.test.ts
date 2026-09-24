import { describe, expect, it, vi } from 'vitest'
import { writeGenerationPromptNode } from './writeGenerationPrompt.js'
import * as promptAgent from '../../agents/writeGenerationPrompt.js'
import { createInitialState } from '../state.js'

vi.mock('../../agents/writeGenerationPrompt.js', () => ({ writeGenerationPrompt: vi.fn() }))
vi.mock('../../env.js', async () => {
  const actual = await vi.importActual<typeof import('../../env.js')>('../../env.js')
  return { ...actual, getCursorApiKey: () => 'test-key' }
})

describe('writeGenerationPromptNode', () => {
  it('passes only approved images and sets generationPrompt from the agent result', async () => {
    vi.mocked(promptAgent.writeGenerationPrompt).mockResolvedValue('a very detailed prompt')
    const state = createInitialState('run-1', 'nasi lemak')
    state.referenceImages = [
      { id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/tmp/a.jpg', status: 'approved' },
      { id: 'b', sourceUrl: 'https://x/b.jpg', localPath: '/tmp/b.jpg', status: 'rejected' },
    ]

    const result = await writeGenerationPromptNode(state)

    expect(result.generationPrompt).toBe('a very detailed prompt')
    const call = vi.mocked(promptAgent.writeGenerationPrompt).mock.calls[0][0]
    expect(call.approvedImages).toHaveLength(1)
    expect(call.approvedImages[0].id).toBe('a')
  })
})
