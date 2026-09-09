import { randomUUID } from 'node:crypto'
import { StateGraph, START, END, MemorySaver, Command } from '@langchain/langgraph'
import { RunAnnotation, createInitialState, toPublicRunState, type GraphState } from './state.js'
import { searchReferences } from './nodes/searchReferences.js'
import { screenReferencesNode } from './nodes/screenReferences.js'
import { reviewReferences } from './nodes/reviewReferences.js'
import { writeGenerationPromptNode } from './nodes/writeGenerationPrompt.js'
import { generateImageNode } from './nodes/generateImage.js'
import { reviewFinal } from './nodes/reviewFinal.js'
import { routeAfterReviewFinal, routeAfterReviewReferences } from './routers.js'
import { toPublicPath } from '../env.js'
import type {
  PendingInterrupt,
  ReferenceImage,
  ResumeFinalPayload,
  ResumeReferencesPayload,
  RunSnapshot,
} from '../../shared/types.js'

const checkpointer = new MemorySaver()

const compiledGraph = new StateGraph(RunAnnotation)
  .addNode('searchReferences', searchReferences)
  .addNode('screenReferences', screenReferencesNode)
  .addNode('reviewReferences', reviewReferences)
  .addNode('writeGenerationPrompt', writeGenerationPromptNode)
  .addNode('generateImage', generateImageNode)
  .addNode('reviewFinal', reviewFinal)
  .addEdge(START, 'searchReferences')
  .addEdge('searchReferences', 'screenReferences')
  .addEdge('screenReferences', 'reviewReferences')
  .addConditionalEdges('reviewReferences', routeAfterReviewReferences)
  .addEdge('writeGenerationPrompt', 'generateImage')
  .addEdge('generateImage', 'reviewFinal')
  .addConditionalEdges('reviewFinal', routeAfterReviewFinal)
  .compile({ checkpointer })

type ReferencesInterruptValue = { type: 'references'; images: ReferenceImage[]; capped: boolean }
type FinalInterruptValue = { type: 'final'; imagePath: string; capped: boolean }

function pendingInterruptFrom(tasks: { interrupts: { value: unknown }[] }[]): PendingInterrupt {
  for (const task of tasks) {
    for (const item of task.interrupts) {
      const value = item.value as ReferencesInterruptValue | FinalInterruptValue
      if (value.type === 'references') {
        return {
          type: 'references',
          images: value.images.map((image) => ({ ...image, localPath: toPublicPath(image.localPath) })),
          capped: value.capped,
        }
      }
      return { type: 'final', imageUrl: toPublicPath(value.imagePath), capped: value.capped }
    }
  }
  return null
}

function configFor(runId: string) {
  return { configurable: { thread_id: runId } }
}

async function invokeAndCapture(input: unknown, config: ReturnType<typeof configFor>): Promise<void> {
  try {
    await compiledGraph.invoke(input, config)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await compiledGraph.updateState(config, { runStatus: 'failed', error: message })
  }
}

export async function startRun(prompt: string): Promise<RunSnapshot> {
  const runId = randomUUID()
  const config = configFor(runId)
  await invokeAndCapture(createInitialState(runId, prompt), config)
  const snapshot = await getRunSnapshot(runId)
  if (!snapshot) throw new Error(`Run ${runId} disappeared immediately after starting`)
  return snapshot
}

export async function resumeRun(
  runId: string,
  payload: ResumeReferencesPayload | ResumeFinalPayload,
): Promise<RunSnapshot | null> {
  const config = configFor(runId)
  const existing = await compiledGraph.getState(config)
  if (!existing.values || Object.keys(existing.values).length === 0) return null
  await invokeAndCapture(new Command({ resume: payload }), config)
  return getRunSnapshot(runId)
}

export async function getRunSnapshot(runId: string): Promise<RunSnapshot | null> {
  const config = configFor(runId)
  const snapshot = await compiledGraph.getState(config)
  if (!snapshot.values || Object.keys(snapshot.values).length === 0) return null
  const state = snapshot.values as GraphState
  return {
    runId,
    state: toPublicRunState(state),
    pendingInterrupt: pendingInterruptFrom(snapshot.tasks),
  }
}
