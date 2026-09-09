import { interrupt } from '@langchain/langgraph'
import { applyReferenceDecisions, decideReferenceOutcome } from '../decisions.js'
import type { GraphState } from '../state.js'
import type { ReferenceImage, ResumeReferencesPayload } from '../../../shared/types.js'

type ReferencesInterruptValue = { type: 'references'; images: ReferenceImage[]; capped: boolean }

export async function reviewReferences(state: GraphState): Promise<Partial<GraphState>> {
  const payload = interrupt<ReferencesInterruptValue, ResumeReferencesPayload>({
    type: 'references',
    images: state.referenceImages,
    capped: state.runStatus === 'capped-references',
  })

  const { referenceImages, excludedSourceUrls } = applyReferenceDecisions(
    state.referenceImages,
    state.excludedSourceUrls,
    payload.decisions,
  )
  const outcome = decideReferenceOutcome({
    referenceImages,
    referenceRound: state.referenceRound,
    runStatus: state.runStatus,
  })

  if (outcome === 'proceed') {
    return { referenceImages, excludedSourceUrls, runStatus: 'working', lastReferenceOutcome: outcome }
  }
  if (outcome === 'retry') {
    return {
      referenceImages,
      excludedSourceUrls,
      referenceRound: state.referenceRound + 1,
      runStatus: 'working',
      lastReferenceOutcome: outcome,
    }
  }
  if (outcome === 'hold-capped') {
    return { referenceImages, excludedSourceUrls, runStatus: 'capped-references', lastReferenceOutcome: outcome }
  }
  return { referenceImages, excludedSourceUrls, runStatus: 'abandoned', lastReferenceOutcome: outcome }
}
