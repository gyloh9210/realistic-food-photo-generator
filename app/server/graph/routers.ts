import { END } from '@langchain/langgraph'
import type { GraphState } from './state.js'

export function routeAfterReviewReferences(
  state: GraphState,
): 'searchReferences' | 'writeGenerationPrompt' | 'reviewReferences' | typeof END {
  switch (state.lastReferenceOutcome) {
    case 'proceed':
      return 'writeGenerationPrompt'
    case 'retry':
      return 'searchReferences'
    case 'hold-capped':
      return 'reviewReferences'
    case 'abandon':
      return END
    default:
      return 'searchReferences'
  }
}

export function routeAfterReviewFinal(
  state: GraphState,
): 'writeGenerationPrompt' | 'reviewFinal' | typeof END {
  switch (state.lastFinalOutcome) {
    case 'done':
      return END
    case 'retry':
      return 'writeGenerationPrompt'
    case 'hold-capped':
      return 'reviewFinal'
    case 'abandon':
      return END
    default:
      return 'writeGenerationPrompt'
  }
}
