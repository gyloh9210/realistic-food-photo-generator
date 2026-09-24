import { describe, expect, it, vi } from 'vitest'
import { screenReferencesNode } from './screenReferences.js'
import * as screenAgent from '../../agents/screenReferences.js'
import { createInitialState } from '../state.js'

vi.mock('../../agents/screenReferences.js', () => ({ screenReferenceImages: vi.fn() }))
vi.mock('../../env.js', async () => {
  const actual = await vi.importActual<typeof import('../../env.js')>('../../env.js')
  return { ...actual, getCursorApiKey: () => 'test-key' }
})

describe('screenReferencesNode', () => {
  it('merges notes into unscreened images and marks the run paused-references', async () => {
    vi.mocked(screenAgent.screenReferenceImages).mockResolvedValue({ a: 'looks real' })
    const state = createInitialState('run-1', 'nasi lemak')
    state.referenceImages = [{ id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/tmp/a.jpg', status: 'pending' }]

    const result = await screenReferencesNode(state)

    expect(result.referenceImages?.[0].cursorNote).toBe('looks real')
    expect(result.runStatus).toBe('paused-references')
  })

  it('skips already-screened images and still marks paused-references when nothing new needs screening', async () => {
    const state = createInitialState('run-1', 'nasi lemak')
    state.referenceImages = [
      { id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/tmp/a.jpg', status: 'approved', cursorNote: 'already noted' },
    ]

    const result = await screenReferencesNode(state)

    expect(screenAgent.screenReferenceImages).not.toHaveBeenCalled()
    expect(result.runStatus).toBe('paused-references')
    expect(result.referenceImages).toBeUndefined()
  })
})
