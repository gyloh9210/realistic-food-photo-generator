export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'stopped'

export type SpecStage = 'in-progress' | 'done'

export type FeatureJob = {
  id: string
  title: string
  specPath: string
  specStage: SpecStage
  branch: string
  worktreePath: string
  status: JobStatus
  agentRunId?: string
  error?: string
  startedAt?: string
  finishedAt?: string
  updatedAt: string
}

export type GitSummary = {
  branch: string
  dirty: boolean
  ahead?: number
  behind?: number
}

export type JobWithGit = FeatureJob & { git?: GitSummary }

export type WorkflowConfig = {
  engineerModel: string
  maxConcurrent: number
}
