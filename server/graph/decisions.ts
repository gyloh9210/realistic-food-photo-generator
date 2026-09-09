import type { ReferenceDecision, ReferenceImage, ResumeFinalPayload, RunStatus, FinalStatus } from '../../shared/types.js'

export const MAX_ROUNDS = 5

export function applyReferenceDecisions(
  referenceImages: ReferenceImage[],
  excludedSourceUrls: string[],
  decisions: ReferenceDecision[],
): { referenceImages: ReferenceImage[]; excludedSourceUrls: string[] } {
  const decisionById = new Map(decisions.map((decision) => [decision.id, decision]))
  const updatedImages = referenceImages.map((image) => {
    const decision = decisionById.get(image.id)
    if (!decision) return image
    return { ...image, status: decision.status, rejectReason: decision.rejectReason }
  })
  const newlyRejectedUrls = updatedImages
    .filter((image) => image.status === 'rejected')
    .map((image) => image.sourceUrl)
  const excludedSet = new Set([...excludedSourceUrls, ...newlyRejectedUrls])
  return { referenceImages: updatedImages, excludedSourceUrls: [...excludedSet] }
}

export type ReferenceReviewOutcome = 'proceed' | 'retry' | 'hold-capped' | 'abandon'

export function decideReferenceOutcome(params: {
  referenceImages: ReferenceImage[]
  referenceRound: number
  runStatus: RunStatus
}): ReferenceReviewOutcome {
  const { referenceImages, referenceRound, runStatus } = params
  const allApproved =
    referenceImages.length > 0 && referenceImages.every((image) => image.status === 'approved')
  if (allApproved) return 'proceed'
  if (runStatus === 'capped-references') return 'abandon'
  if (referenceRound >= MAX_ROUNDS) return 'hold-capped'
  return 'retry'
}

export function applyFinalDecision(payload: ResumeFinalPayload): {
  finalStatus: FinalStatus
  finalRejectReason: string | undefined
} {
  return { finalStatus: payload.status, finalRejectReason: payload.rejectReason }
}

export type FinalReviewOutcome = 'done' | 'retry' | 'hold-capped' | 'abandon'

export function decideFinalOutcome(params: {
  finalStatus: FinalStatus
  finalRound: number
  runStatus: RunStatus
}): FinalReviewOutcome {
  const { finalStatus, finalRound, runStatus } = params
  if (finalStatus === 'approved') return 'done'
  if (runStatus === 'capped-final') return 'abandon'
  if (finalRound >= MAX_ROUNDS) return 'hold-capped'
  return 'retry'
}
