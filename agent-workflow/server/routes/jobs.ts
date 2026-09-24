import { Router } from 'express'
import { readdir, readFile } from 'node:fs/promises'
import { ENGINEER_MODEL, MAX_CONCURRENT_ENGINEER_RUNS, READY_SPEC_DIR } from '../env.js'
import { getGitSummary } from '../services/gitStatus.js'
import { readLogTail } from '../services/logs.js'
import { getJob, listJobs } from '../services/registry.js'
import { toRepoRelative } from '../services/specLifecycle.js'

export const jobsRouter = Router()

jobsRouter.get('/config', (_req, res) => {
  res.json({
    engineerModel: ENGINEER_MODEL,
    maxConcurrent: MAX_CONCURRENT_ENGINEER_RUNS,
  })
})

jobsRouter.get('/jobs', async (_req, res) => {
  const jobs = await listJobs()
  const withGit = await Promise.all(
    jobs.map(async (job) => ({
      ...job,
      specPath: toRepoRelative(job.specPath),
      worktreePath: job.worktreePath,
      git: await getGitSummary(job.worktreePath),
    })),
  )
  res.json(withGit)
})

jobsRouter.get('/jobs/:id', async (req, res) => {
  const job = await getJob(req.params.id)
  if (!job) {
    res.status(404).json({ error: 'job not found' })
    return
  }
  let specContent = ''
  try {
    specContent = await readFile(job.specPath, 'utf8')
  } catch {
    specContent = ''
  }
  const git = await getGitSummary(job.worktreePath)
  res.json({
    ...job,
    specPath: toRepoRelative(job.specPath),
    specContent,
    git,
  })
})

jobsRouter.get('/jobs/:id/log', async (req, res) => {
  const job = await getJob(req.params.id)
  if (!job) {
    res.status(404).json({ error: 'job not found' })
    return
  }
  const tail = Number(req.query.tail ?? 200)
  const log = await readLogTail(job.id, Number.isFinite(tail) ? tail : 200)
  res.type('text/plain').send(log)
})

jobsRouter.get('/ready-spec', async (_req, res) => {
  try {
    const names = await readdir(READY_SPEC_DIR)
    const files = names.filter((n) => n.endsWith('.md') && n.toLowerCase() !== 'readme.md')
    res.json({ files })
  } catch {
    res.json({ files: [] })
  }
})
