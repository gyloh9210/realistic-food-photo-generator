import './env.js'
import express from 'express'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DATA_ROOT,
  JOBS_DIR,
  LOGS_DIR,
  PORT,
  READY_SPEC_DIR,
  SPECS_DONE_DIR,
  SPECS_IN_PROGRESS_DIR,
} from './env.js'
import { jobsRouter } from './routes/jobs.js'
import { jobQueue } from './services/jobQueue.js'
import { startReadySpecWatcher } from './services/readySpecWatcher.js'

export const app = express()
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api', jobsRouter)

async function ensureDirs(): Promise<void> {
  await mkdir(DATA_ROOT, { recursive: true })
  await mkdir(JOBS_DIR, { recursive: true })
  await mkdir(LOGS_DIR, { recursive: true })
  await mkdir(READY_SPEC_DIR, { recursive: true })
  await mkdir(SPECS_IN_PROGRESS_DIR, { recursive: true })
  await mkdir(SPECS_DONE_DIR, { recursive: true })
}

const isMainModule =
  Boolean(process.argv[1]) &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

export async function startServer(): Promise<void> {
  await ensureDirs()
  startReadySpecWatcher(jobQueue)
  app.listen(PORT, () => {
    console.log(`[agent-workflow] API http://localhost:${PORT}`)
  })
}

if (isMainModule) {
  void startServer()
}

export { jobQueue }
