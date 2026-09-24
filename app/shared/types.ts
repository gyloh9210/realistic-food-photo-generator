export type ReferenceStatus = 'pending' | 'approved' | 'rejected'

export type ReferenceImage = {
  id: string
  sourceUrl: string
  localPath: string
  cursorNote?: string
  status: ReferenceStatus
  rejectReason?: string
}

export type FinalStatus = 'pending' | 'approved' | 'rejected'

export type RunStatus =
  | 'working'
  | 'paused-references'
  | 'paused-final'
  | 'capped-references'
  | 'capped-final'
  | 'done'
  | 'abandoned'
  | 'failed'

export type RunState = {
  prompt: string
  referenceImages: ReferenceImage[]
  excludedSourceUrls: string[]
  referenceRound: number
  generationPrompt?: string
  generatedImagePath?: string
  finalStatus: FinalStatus
  finalRejectReason?: string
  finalRound: number
  runStatus: RunStatus
  error?: string
}

export type ReferenceDecision = {
  id: string
  status: 'approved' | 'rejected'
  rejectReason?: string
}

export type ResumeReferencesPayload = {
  decisions: ReferenceDecision[]
}

export type ResumeFinalPayload = {
  status: 'approved' | 'rejected'
  rejectReason?: string
}

export type PendingInterrupt =
  | { type: 'references'; images: ReferenceImage[]; capped: boolean }
  | { type: 'final'; imageUrl: string; capped: boolean }
  | null

export type RunSnapshot = {
  runId: string
  state: RunState
  pendingInterrupt: PendingInterrupt
}
