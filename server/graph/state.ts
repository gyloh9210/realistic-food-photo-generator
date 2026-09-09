import { Annotation } from '@langchain/langgraph'
import type { FinalStatus, ReferenceImage, RunState, RunStatus } from '../../shared/types.js'
import type { FinalReviewOutcome, ReferenceReviewOutcome } from './decisions.js'
import { toPublicPath } from '../env.js'

export const RunAnnotation = Annotation.Root({
  runId: Annotation<string>(),
  prompt: Annotation<string>(),
  referenceImages: Annotation<ReferenceImage[]>(),
  excludedSourceUrls: Annotation<string[]>(),
  referenceRound: Annotation<number>(),
  generationPrompt: Annotation<string | undefined>(),
  generatedImagePath: Annotation<string | undefined>(),
  finalStatus: Annotation<FinalStatus>(),
  finalRejectReason: Annotation<string | undefined>(),
  finalRound: Annotation<number>(),
  runStatus: Annotation<RunStatus>(),
  error: Annotation<string | undefined>(),
  lastReferenceOutcome: Annotation<ReferenceReviewOutcome | undefined>(),
  lastFinalOutcome: Annotation<FinalReviewOutcome | undefined>(),
})

export type GraphState = typeof RunAnnotation.State

export function createInitialState(runId: string, prompt: string): GraphState {
  return {
    runId,
    prompt,
    referenceImages: [],
    excludedSourceUrls: [],
    referenceRound: 0,
    generationPrompt: undefined,
    generatedImagePath: undefined,
    finalStatus: 'pending',
    finalRejectReason: undefined,
    finalRound: 0,
    runStatus: 'working',
    error: undefined,
    lastReferenceOutcome: undefined,
    lastFinalOutcome: undefined,
  }
}

export function toPublicRunState(state: GraphState): RunState {
  return {
    prompt: state.prompt,
    referenceImages: state.referenceImages.map((image) => ({
      ...image,
      localPath: toPublicPath(image.localPath),
    })),
    excludedSourceUrls: state.excludedSourceUrls,
    referenceRound: state.referenceRound,
    generationPrompt: state.generationPrompt,
    generatedImagePath: state.generatedImagePath ? toPublicPath(state.generatedImagePath) : undefined,
    finalStatus: state.finalStatus,
    finalRejectReason: state.finalRejectReason,
    finalRound: state.finalRound,
    runStatus: state.runStatus,
    error: state.error,
  }
}
