import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { requireOrigin } from '../../src/http/origin.js'

const A = 'https://tcg-event-hub-123.asia-southeast1.run.app'
const B = 'https://tcg-event-hub-abc-as.a.run.app'

const app = express()
app.post('/write', requireOrigin(`${A},${B}`), (_req, res) => res.status(201).json({ ok: true }))

describe('TEST-L5-04 (I) — requireOrigin accepts every origin in the APP_ORIGIN list and nothing else', () => {
  it.each([A, B])('lets a POST from %s through', async (origin) => {
    const res = await request(app).post('/write').set('Origin', origin)
    expect(res.status).toBe(201)
  })

  it.each([
    ['another site', 'https://evil.example'],
    ['a prefix of a listed origin', 'https://tcg-event-hub-123.asia-southeast1.run'],
    ['the whole list as one value', `${A},${B}`],
  ])('rejects %s with 403 FORBIDDEN', async (_name, origin) => {
    const res = await request(app).post('/write').set('Origin', origin)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('rejects a POST with no Origin header', async () => {
    const res = await request(app).post('/write')
    expect(res.status).toBe(403)
  })
})
