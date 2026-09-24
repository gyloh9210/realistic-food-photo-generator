import { describe, expect, it } from 'vitest'
import { StateGraph, START, END, MemorySaver, Command } from '@langchain/langgraph'
import { RunAnnotation, createInitialState } from '../state.js'
import { reviewFinal } from './reviewFinal.js'

function buildTestGraph() {
  return new StateGraph(RunAnnotation)
    .addNode('reviewFinal', reviewFinal)
    .addEdge(START, 'reviewFinal')
    .addEdge('reviewFinal', END)
    .compile({ checkpointer: new MemorySaver() })
}

describe('reviewFinal', () => {
  it('pauses with the generated image path and resumes to done on approval', async () => {
    const graph = buildTestGraph()
    const config = { configurable: { thread_id: 'f1' } }
    const initial = createInitialState('run-1', 'nasi lemak')
    initial.generatedImagePath = '/tmp/attempt-0.png'

    await graph.invoke(initial, config)
    const paused = await graph.getState(config)
    expect(paused.tasks[0].interrupts[0].value).toMatchObject({ type: 'final', imagePath: '/tmp/attempt-0.png' })

    await graph.invoke(new Command({ resume: { status: 'approved' } }), config)
    const finished = await graph.getState(config)
    expect(finished.values.runStatus).toBe('done')
    expect(finished.values.lastFinalOutcome).toBe('done')
  })

  it('increments finalRound and stays working on a rejection under the cap', async () => {
    const graph = buildTestGraph()
    const config = { configurable: { thread_id: 'f2' } }
    const initial = createInitialState('run-2', 'nasi lemak')
    initial.generatedImagePath = '/tmp/attempt-0.png'

    await graph.invoke(initial, config)
    await graph.invoke(new Command({ resume: { status: 'rejected', rejectReason: 'too glossy' } }), config)
    const finished = await graph.getState(config)
    expect(finished.values.finalRound).toBe(1)
    expect(finished.values.runStatus).toBe('working')
    expect(finished.values.finalRejectReason).toBe('too glossy')
  })

  it('holds capped on the first rejection past the round limit', async () => {
    const graph = buildTestGraph()
    const config = { configurable: { thread_id: 'f3' } }
    const initial = createInitialState('run-3', 'nasi lemak')
    initial.generatedImagePath = '/tmp/attempt-5.png'
    initial.finalRound = 5

    await graph.invoke(initial, config)
    await graph.invoke(new Command({ resume: { status: 'rejected', rejectReason: 'still bad' } }), config)
    const finished = await graph.getState(config)
    expect(finished.values.runStatus).toBe('capped-final')
    expect(finished.values.lastFinalOutcome).toBe('hold-capped')
  })
})
