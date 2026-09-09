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
