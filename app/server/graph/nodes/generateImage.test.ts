import { describe, expect, it, vi } from 'vitest'
import { generateImageNode } from './generateImage.js'
import * as generateAgent from '../../agents/generateImage.js'
import { createInitialState } from '../state.js'

vi.mock('../../agents/generateImage.js', () => ({ generateFoodImage: vi.fn() }))
vi.mock('../../env.js', async () => {
  const actual = await vi.importActual<typeof import('../../env.js')>('../../env.js')
  return { ...actual, getCursorApiKey: () => 'test-key' }
})

describe('generateImageNode', () => {
  it('generates from the state generationPrompt and marks paused-final', async () => {
    vi.mocked(generateAgent.generateFoodImage).mockResolvedValue(undefined)
    const state = createInitialState('run-1', 'nasi lemak')
    state.generationPrompt = 'a very detailed prompt'

    const result = await generateImageNode(state)

    expect(result.runStatus).toBe('paused-final')
    expect(result.generatedImagePath).toContain('run-1')
    expect(generateAgent.generateFoodImage).toHaveBeenCalledWith(
      expect.objectContaining({ generationPrompt: 'a very detailed prompt' }),
    )
  })

  it('throws if generationPrompt is missing', async () => {
    const state = createInitialState('run-1', 'nasi lemak')
    await expect(generateImageNode(state)).rejects.toThrow('requires generationPrompt')
  })
})
