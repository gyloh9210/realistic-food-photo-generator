import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from './index.js'

describe('agent-workflow API', () => {
  it('health', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('config', async () => {
    const res = await request(app).get('/api/config')
    expect(res.status).toBe(200)
    expect(res.body.engineerModel).toBeTruthy()
    expect(res.body.maxConcurrent).toBeGreaterThan(0)
  })
})
