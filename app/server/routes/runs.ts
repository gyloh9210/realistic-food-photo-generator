import { Router } from 'express'
import { getRunSnapshot, resumeRun, startRun } from '../graph/build.js'
import type {
  ReferenceDecision,
  ResumeFinalPayload,
  ResumeReferencesPayload,
} from '../../shared/types.js'

export const runsRouter = Router()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseOptionalReason(value: unknown): { ok: true; reason: string | undefined } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, reason: undefined }
  if (typeof value !== 'string') return { ok: false }
  return { ok: true, reason: value }
}

/** Returns the validated payload, or null if `body` isn't a reference-decisions payload. */
function parseReferencesPayload(body: unknown): ResumeReferencesPayload | null {
  if (!isRecord(body)) return null
  const { decisions } = body
  // An empty array is legitimate: a search round can legitimately turn up zero
  // downloadable candidates, and the human still has to submit that review.
  if (!Array.isArray(decisions)) return null

  const parsed: ReferenceDecision[] = []
  for (const raw of decisions) {
    if (!isRecord(raw)) return null
    const { id, status, rejectReason } = raw
    if (typeof id !== 'string' || id.length === 0) return null
    if (status !== 'approved' && status !== 'rejected') return null
    const reason = parseOptionalReason(rejectReason)
    if (!reason.ok) return null
    parsed.push({ id, status, rejectReason: reason.reason })
  }
  return { decisions: parsed }
}

/** Returns the validated payload, or null if `body` isn't a final-review payload. */
function parseFinalPayload(body: unknown): ResumeFinalPayload | null {
  if (!isRecord(body)) return null
  const { status, rejectReason } = body
  if (status !== 'approved' && status !== 'rejected') return null
  const reason = parseOptionalReason(rejectReason)
  if (!reason.ok) return null
  return { status, rejectReason: reason.reason }
}

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
  // Validate before touching the graph: an unvalidated payload throws deep
  // inside a node, which `invokeAndCapture` persists as a permanent
  // `runStatus: 'failed'` with no way back. A client bug must not be able to
  // destroy an otherwise-healthy run.
  const current = await getRunSnapshot(req.params.id)
  if (!current) {
    res.status(404).json({ error: 'run not found' })
    return
  }

  const pending = current.pendingInterrupt
  if (!pending) {
    res.status(400).json({ error: 'run is not currently waiting for a review' })
    return
  }

  let payload: ResumeReferencesPayload | ResumeFinalPayload
  if (pending.type === 'references') {
    const parsed = parseReferencesPayload(req.body)
    if (!parsed) {
      res.status(400).json({
        error:
          'expected a reference-review payload: { decisions: [{ id, status: "approved" | "rejected", rejectReason? }] }',
      })
      return
    }
    payload = parsed
  } else {
    const parsed = parseFinalPayload(req.body)
    if (!parsed) {
      res.status(400).json({
        error: 'expected a final-review payload: { status: "approved" | "rejected", rejectReason? }',
      })
      return
    }
    payload = parsed
  }

  const snapshot = await resumeRun(req.params.id, payload)
  if (!snapshot) {
    res.status(404).json({ error: 'run not found' })
    return
  }
  res.json(snapshot)
})
