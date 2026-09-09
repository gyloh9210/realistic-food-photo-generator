import { interrupt } from '@langchain/langgraph'
import { applyFinalDecision, decideFinalOutcome } from '../decisions.js'
import type { GraphState } from '../state.js'
import type { ResumeFinalPayload } from '../../../shared/types.js'

type FinalInterruptValue = { type: 'final'; imagePath: string; capped: boolean }

export async function reviewFinal(state: GraphState): Promise<Partial<GraphState>> {
  const payload = interrupt<FinalInterruptValue, ResumeFinalPayload>({
    type: 'final',
    imagePath: state.generatedImagePath ?? '',
    capped: state.runStatus === 'capped-final',
  })

  const { finalStatus, finalRejectReason } = applyFinalDecision(payload)
  const outcome = decideFinalOutcome({ finalStatus, finalRound: state.finalRound, runStatus: state.runStatus })

  if (outcome === 'done') {
    return { finalStatus, finalRejectReason, runStatus: 'done', lastFinalOutcome: outcome }
  }
  if (outcome === 'retry') {
    return {
      finalStatus,
      finalRejectReason,
      finalRound: state.finalRound + 1,
      runStatus: 'working',
      lastFinalOutcome: outcome,
    }
  }
  if (outcome === 'hold-capped') {
    return { finalStatus, finalRejectReason, runStatus: 'capped-final', lastFinalOutcome: outcome }
  }
  return { finalStatus, finalRejectReason, runStatus: 'abandoned', lastFinalOutcome: outcome }
}
