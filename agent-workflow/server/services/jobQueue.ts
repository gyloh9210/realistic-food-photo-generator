import path from 'node:path'
import type { FeatureJob } from '../../shared/types.js'
import { MAX_CONCURRENT_ENGINEER_RUNS } from '../env.js'
import { runEngineerForJob } from './engineerRunner.js'
import { appendLog } from './logs.js'
import { createJob, getJob, nowIso, updateJob } from './registry.js'
import {
  moveSpecToDone,
  readTitleFromSpecFile,
  toRepoRelative,
} from './specLifecycle.js'
import { createWorktreeForSlug } from './worktrees.js'
import { branchForSlug } from '../../shared/slug.js'

type QueueItem = { jobId: string }

export class JobQueue {
  private readonly pending: QueueItem[] = []
  private active = 0

  enqueue(jobId: string): void {
    this.pending.push({ jobId })
    void this.pump()
  }

  enqueueNewFromPickup(params: {
    slug: string
    specAbsolutePath: string
    filename: string
  }): Promise<FeatureJob> {
    return this.registerAndEnqueue(params)
  }

  async retry(jobId: string): Promise<void> {
    const job = await getJob(jobId)
    if (!job) throw new Error(`Job not found: ${jobId}`)
    if (job.status === 'running') throw new Error(`Job already running: ${jobId}`)
    await updateJob(jobId, { status: 'queued', error: undefined })
    this.enqueue(jobId)
  }

  private async registerAndEnqueue(params: {
    slug: string
    specAbsolutePath: string
    filename: string
  }): Promise<FeatureJob> {
    const { slug, specAbsolutePath, filename } = params
    const worktreePath = await createWorktreeForSlug(slug)
    const title = await readTitleFromSpecFile(specAbsolutePath, slug)
    const job = await createJob({
      id: slug,
      title,
      specPath: specAbsolutePath,
      specStage: 'in-progress',
      branch: branchForSlug(slug),
      worktreePath,
      status: 'queued',
    })
    await appendLog(slug, `Job queued for ${filename}`)
    this.enqueue(slug)
    return job
  }

  private async pump(): Promise<void> {
    while (this.active < MAX_CONCURRENT_ENGINEER_RUNS && this.pending.length > 0) {
      const item = this.pending.shift()!
      this.active += 1
      void this.runOne(item.jobId).finally(() => {
        this.active -= 1
        void this.pump()
      })
    }
  }

  private async runOne(jobId: string): Promise<void> {
    let job = await getJob(jobId)
    if (!job) return

    job = await updateJob(jobId, { status: 'running', startedAt: job.startedAt ?? nowIso() })

    const result = await runEngineerForJob(job)

    if (result.ok) {
      let specPath = job.specPath
      let specStage = job.specStage
      if (job.specStage === 'in-progress') {
        const filename = path.basename(job.specPath)
        specPath = await moveSpecToDone(job.specPath, filename)
        specStage = 'done'
      }
      await updateJob(jobId, {
        status: 'done',
        specStage,
        specPath,
        agentRunId: result.agentRunId || job.agentRunId,
        finishedAt: nowIso(),
        error: undefined,
      })
      await appendLog(jobId, `Job done; spec at ${toRepoRelative(specPath)}`)
      return
    }

    await updateJob(jobId, {
      status: 'failed',
      agentRunId: result.agentRunId || job.agentRunId,
      finishedAt: nowIso(),
      error: result.error,
    })
    await appendLog(jobId, `Job failed: ${result.error}`)
  }
}

export const jobQueue = new JobQueue()
