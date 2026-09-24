import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { createInitialState, toPublicRunState } from './state.js'

describe('createInitialState', () => {
  it('builds a fresh working state for a new run', () => {
    const state = createInitialState('run-1', 'nasi lemak with fried chicken')
    expect(state).toMatchObject({
      runId: 'run-1',
      prompt: 'nasi lemak with fried chicken',
      referenceImages: [],
      excludedSourceUrls: [],
      referenceRound: 0,
      finalStatus: 'pending',
      finalRound: 0,
      runStatus: 'working',
    })
  })
})

describe('toPublicRunState', () => {
  it('strips internal fields and rewrites local paths to public URLs', () => {
    const state = createInitialState('run-1', 'nasi lemak')
    state.referenceImages = [
      {
        id: 'a',
        sourceUrl: 'https://x/a.jpg',
        localPath: path.join(process.cwd(), 'runs', 'run-1', 'references', 'a.jpg'),
        status: 'pending',
      },
    ]
    state.generatedImagePath = path.join(process.cwd(), 'runs', 'run-1', 'generated', 'attempt-0.png')

    const publicState = toPublicRunState(state) as Record<string, unknown>

    expect(publicState).not.toHaveProperty('runId')
    expect(publicState).not.toHaveProperty('lastReferenceOutcome')
    expect(publicState).not.toHaveProperty('lastFinalOutcome')
    expect((publicState.referenceImages as { localPath: string }[])[0].localPath).toBe(
      '/run-files/run-1/references/a.jpg',
    )
    expect(publicState.generatedImagePath).toBe('/run-files/run-1/generated/attempt-0.png')
  })
})
