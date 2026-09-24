import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { runsRouter } from './runs.js'
import * as build from '../graph/build.js'
import type { RunSnapshot } from '../../shared/types.js'

vi.mock('../graph/build.js', () => ({
  startRun: vi.fn(),
  resumeRun: vi.fn(),
  getRunSnapshot: vi.fn(),
}))

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/runs', runsRouter)
  return app
}

describe('runsRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST / creates a run and returns its id', async () => {
    vi.mocked(build.startRun).mockResolvedValue({ runId: 'run-1', state: {} as never, pendingInterrupt: null })

    const response = await request(makeApp()).post('/api/runs').send({ prompt: 'nasi lemak' })

    expect(response.status).toBe(201)
    expect(response.body).toEqual({ runId: 'run-1' })
    expect(build.startRun).toHaveBeenCalledWith('nasi lemak')
  })

  it('POST / rejects an empty prompt', async () => {
    const response = await request(makeApp()).post('/api/runs').send({ prompt: '  ' })
    expect(response.status).toBe(400)
    expect(build.startRun).not.toHaveBeenCalled()
  })

  it('GET /:id returns 404 for an unknown run', async () => {
    vi.mocked(build.getRunSnapshot).mockResolvedValue(null)
    const response = await request(makeApp()).get('/api/runs/unknown')
    expect(response.status).toBe(404)
  })

  it('GET /:id returns the snapshot for a known run', async () => {
    vi.mocked(build.getRunSnapshot).mockResolvedValue({ runId: 'run-1', state: {} as never, pendingInterrupt: null })
    const response = await request(makeApp()).get('/api/runs/run-1')
    expect(response.status).toBe(200)
    expect(response.body.runId).toBe('run-1')
  })

  function pendingReferences(): RunSnapshot {
    return {
      runId: 'run-1',
      state: {} as never,
      pendingInterrupt: { type: 'references', capped: false, images: [] },
    }
  }

  function pendingFinal(): RunSnapshot {
    return {
      runId: 'run-1',
      state: {} as never,
      pendingInterrupt: { type: 'final', capped: false, imageUrl: '/run-files/run-1/generated/attempt-0.png' },
    }
  }

  it('POST /:id/resume forwards the payload and returns the updated snapshot', async () => {
    vi.mocked(build.getRunSnapshot).mockResolvedValue(pendingReferences())
    vi.mocked(build.resumeRun).mockResolvedValue({ runId: 'run-1', state: {} as never, pendingInterrupt: null })

    const response = await request(makeApp())
      .post('/api/runs/run-1/resume')
      .send({ decisions: [{ id: 'a', status: 'approved' }] })

    expect(response.status).toBe(200)
    expect(build.resumeRun).toHaveBeenCalledWith('run-1', {
      decisions: [{ id: 'a', status: 'approved', rejectReason: undefined }],
    })
  })

  it('POST /:id/resume forwards a final-review payload when the final gate is pending', async () => {
    vi.mocked(build.getRunSnapshot).mockResolvedValue(pendingFinal())
    vi.mocked(build.resumeRun).mockResolvedValue({ runId: 'run-1', state: {} as never, pendingInterrupt: null })

    const response = await request(makeApp())
      .post('/api/runs/run-1/resume')
      .send({ status: 'rejected', rejectReason: 'too glossy' })

    expect(response.status).toBe(200)
    expect(build.resumeRun).toHaveBeenCalledWith('run-1', { status: 'rejected', rejectReason: 'too glossy' })
  })

  it('POST /:id/resume returns 404 for an unknown run', async () => {
    vi.mocked(build.getRunSnapshot).mockResolvedValue(null)
    const response = await request(makeApp()).post('/api/runs/unknown/resume').send({ status: 'approved' })
    expect(response.status).toBe(404)
    expect(build.resumeRun).not.toHaveBeenCalled()
  })

  it('POST /:id/resume rejects an empty body with 400 instead of failing the run', async () => {
    vi.mocked(build.getRunSnapshot).mockResolvedValue(pendingReferences())
    const response = await request(makeApp()).post('/api/runs/run-1/resume').send({})
    expect(response.status).toBe(400)
    expect(build.resumeRun).not.toHaveBeenCalled()
  })

  it('POST /:id/resume rejects malformed decision entries with 400', async () => {
    vi.mocked(build.getRunSnapshot).mockResolvedValue(pendingReferences())

    const badBodies = [
      { decisions: 'nope' },
      { decisions: [{ status: 'approved' }] },
      { decisions: [{ id: 'a' }] },
      { decisions: [{ id: 'a', status: 'maybe' }] },
      { decisions: [{ id: 'a', status: 'rejected', rejectReason: 42 }] },
      { decisions: [null] },
    ]

    for (const body of badBodies) {
      const response = await request(makeApp()).post('/api/runs/run-1/resume').send(body)
      expect(response.status, JSON.stringify(body)).toBe(400)
    }
    expect(build.resumeRun).not.toHaveBeenCalled()
  })

  it('POST /:id/resume rejects a final payload while the references gate is pending', async () => {
    vi.mocked(build.getRunSnapshot).mockResolvedValue(pendingReferences())
    const response = await request(makeApp()).post('/api/runs/run-1/resume').send({ status: 'approved' })
    expect(response.status).toBe(400)
    expect(response.body.error).toContain('reference-review payload')
    expect(build.resumeRun).not.toHaveBeenCalled()
  })

  it('POST /:id/resume rejects a references payload while the final gate is pending', async () => {
    vi.mocked(build.getRunSnapshot).mockResolvedValue(pendingFinal())
    const response = await request(makeApp())
      .post('/api/runs/run-1/resume')
      .send({ decisions: [{ id: 'a', status: 'approved' }] })
    expect(response.status).toBe(400)
    expect(response.body.error).toContain('final-review payload')
    expect(build.resumeRun).not.toHaveBeenCalled()
  })

  it('POST /:id/resume rejects a bad final status with 400', async () => {
    vi.mocked(build.getRunSnapshot).mockResolvedValue(pendingFinal())
    const response = await request(makeApp()).post('/api/runs/run-1/resume').send({ status: 'sortof' })
    expect(response.status).toBe(400)
    expect(build.resumeRun).not.toHaveBeenCalled()
  })

  it('POST /:id/resume rejects a resume when no interrupt is pending', async () => {
    vi.mocked(build.getRunSnapshot).mockResolvedValue({
      runId: 'run-1',
      state: {} as never,
      pendingInterrupt: null,
    })
    const response = await request(makeApp()).post('/api/runs/run-1/resume').send({ status: 'approved' })
    expect(response.status).toBe(400)
    expect(response.body.error).toContain('not currently waiting')
    expect(build.resumeRun).not.toHaveBeenCalled()
  })

  it('POST /:id/resume accepts an empty decisions array (a round that found no candidates)', async () => {
    vi.mocked(build.getRunSnapshot).mockResolvedValue(pendingReferences())
    vi.mocked(build.resumeRun).mockResolvedValue({ runId: 'run-1', state: {} as never, pendingInterrupt: null })

    const response = await request(makeApp()).post('/api/runs/run-1/resume').send({ decisions: [] })

    expect(response.status).toBe(200)
    expect(build.resumeRun).toHaveBeenCalledWith('run-1', { decisions: [] })
  })
})
