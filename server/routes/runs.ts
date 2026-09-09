import { Router } from 'express'
import { getRunSnapshot, resumeRun, startRun } from '../graph/build.js'
import type { ResumeFinalPayload, ResumeReferencesPayload } from '../../shared/types.js'

export const runsRouter = Router()

runsRouter.post('/', async (req, res) => {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : ''
  if (!prompt) {
    res.status(400).json({ error: 'prompt is required' })
    return
  }
  const snapshot = await startRun(prompt)
  res.status(201).json({ runId: snapshot.runId })
})

runsRouter.get('/:id', async (req, res) => {
  const snapshot = await getRunSnapshot(req.params.id)
  if (!snapshot) {
    res.status(404).json({ error: 'run not found' })
    return
  }
  res.json(snapshot)
})

runsRouter.post('/:id/resume', async (req, res) => {
  const payload = req.body as ResumeReferencesPayload | ResumeFinalPayload
  const snapshot = await resumeRun(req.params.id, payload)
  if (!snapshot) {
    res.status(404).json({ error: 'run not found' })
    return
  }
  res.json(snapshot)
})
