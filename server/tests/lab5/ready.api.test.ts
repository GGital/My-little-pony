import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { makeApp, spyLogger } from '../helpers/app.js'
import { prisma } from '../helpers/db.js'

// As in TEST-SR4-01: a second client pointed at an address where nothing listens.
const unreachable = new PrismaClient({ datasourceUrl: 'postgresql://nobody:nothing@127.0.0.1:1/none?connect_timeout=2' })

afterAll(async () => {
  await unreachable.$disconnect()
  await prisma.$disconnect()
})

describe('TEST-L5-02 (I) — GET /api/ready for the smoke test and Cloud Run (Lab 5 Ep. 2 point 6)', () => {
  it('answers 200 {status:"ready", db:"connected"} when the database answers', async () => {
    const res = await request(makeApp()).get('/api/ready')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ready', db: 'connected' })
  })

  it('answers 503 {status:"not_ready"} when the database cannot be reached, without leaking why', async () => {
    const { log, entries } = spyLogger()
    const res = await request(makeApp({ prisma: unreachable, log })).get('/api/ready')
    expect(res.status).toBe(503)
    expect(res.body).toEqual({ status: 'not_ready' })
    expect(res.text).not.toMatch(/127\.0\.0\.1|prisma|nobody/i)
    expect(entries.some((e) => e.level === 'error')).toBe(true)
  })
})
