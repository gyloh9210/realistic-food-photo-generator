import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { runsRouter } from './runs.js'
import * as build from '../graph/build.js'

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

  it('POST /:id/resume forwards the payload and returns the updated snapshot', async () => {
    vi.mocked(build.resumeRun).mockResolvedValue({ runId: 'run-1', state: {} as never, pendingInterrupt: null })

    const response = await request(makeApp())
      .post('/api/runs/run-1/resume')
      .send({ decisions: [{ id: 'a', status: 'approved' }] })

    expect(response.status).toBe(200)
    expect(build.resumeRun).toHaveBeenCalledWith('run-1', { decisions: [{ id: 'a', status: 'approved' }] })
  })

  it('POST /:id/resume returns 404 for an unknown run', async () => {
    vi.mocked(build.resumeRun).mockResolvedValue(null)
    const response = await request(makeApp()).post('/api/runs/unknown/resume').send({ status: 'approved' })
    expect(response.status).toBe(404)
  })
})
