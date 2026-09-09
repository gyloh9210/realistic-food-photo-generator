import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from './index.js'

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    const response = await request(app).get('/api/health')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
  })
})
