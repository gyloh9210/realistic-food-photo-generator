import { describe, expect, it } from 'vitest'
import { StateGraph, START, END, MemorySaver, Command } from '@langchain/langgraph'
import { RunAnnotation, createInitialState } from '../state.js'
import { reviewReferences } from './reviewReferences.js'

function buildTestGraph() {
  return new StateGraph(RunAnnotation)
    .addNode('reviewReferences', reviewReferences)
    .addEdge(START, 'reviewReferences')
    .addEdge('reviewReferences', END)
    .compile({ checkpointer: new MemorySaver() })
}

describe('reviewReferences', () => {
  it('pauses with the current images and resumes to proceed when all approved', async () => {
    const graph = buildTestGraph()
    const config = { configurable: { thread_id: 't1' } }
    const initial = createInitialState('run-1', 'nasi lemak')
    initial.referenceImages = [{ id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/tmp/a.jpg', status: 'pending' }]

    await graph.invoke(initial, config)
    const paused = await graph.getState(config)
    expect(paused.next).toEqual(['reviewReferences'])
    expect(paused.tasks[0].interrupts[0].value).toMatchObject({ type: 'references', capped: false })

    await graph.invoke(new Command({ resume: { decisions: [{ id: 'a', status: 'approved' }] } }), config)
    const finished = await graph.getState(config)
    expect(finished.values.referenceImages[0].status).toBe('approved')
    expect(finished.values.runStatus).toBe('working')
    expect(finished.values.lastReferenceOutcome).toBe('proceed')
  })

  it('increments the round and stays working on a retry decision', async () => {
    const graph = buildTestGraph()
    const config = { configurable: { thread_id: 't2' } }
    const initial = createInitialState('run-2', 'nasi lemak')
    initial.referenceImages = [{ id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/tmp/a.jpg', status: 'pending' }]

    await graph.invoke(initial, config)
    await graph.invoke(
      new Command({ resume: { decisions: [{ id: 'a', status: 'rejected', rejectReason: 'AI-looking' }] } }),
      config,
    )
    const finished = await graph.getState(config)
    expect(finished.values.referenceRound).toBe(1)
    expect(finished.values.runStatus).toBe('working')
    expect(finished.values.lastReferenceOutcome).toBe('retry')
    expect(finished.values.excludedSourceUrls).toEqual(['https://x/a.jpg'])
  })

  it('abandons when already capped and rejected again', async () => {
    const graph = buildTestGraph()
    const config = { configurable: { thread_id: 't3' } }
    const initial = createInitialState('run-3', 'nasi lemak')
    initial.referenceImages = [{ id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/tmp/a.jpg', status: 'pending' }]
    initial.referenceRound = 5
    initial.runStatus = 'capped-references'

    await graph.invoke(initial, config)
    await graph.invoke(
      new Command({ resume: { decisions: [{ id: 'a', status: 'rejected', rejectReason: 'still bad' }] } }),
      config,
    )
    const finished = await graph.getState(config)
    expect(finished.values.runStatus).toBe('abandoned')
    expect(finished.values.lastReferenceOutcome).toBe('abandon')
  })
})
