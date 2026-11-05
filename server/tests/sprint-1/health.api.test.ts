import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { makeApp, spyLogger } from '../helpers/app.js'
import { prisma } from '../helpers/db.js'

// STS §1.4: a second Prisma client pointed at an address where nothing listens.
const unreachable = new PrismaClient({ datasourceUrl: 'postgresql://nobody:nothing@127.0.0.1:1/none?connect_timeout=2' })

afterAll(async () => {
  await unreachable.$disconnect()
  await prisma.$disconnect()
})

describe('TEST-SR4-01 (I) — E-12 GET /api/health', () => {
  it('answers 200 {status:"ok"} when the database is up', async () => {
    const res = await request(makeApp()).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('answers 503 {status:"unavailable"} when the database cannot be reached, and logs why', async () => {
    const { log, entries } = spyLogger()
    const res = await request(makeApp({ prisma: unreachable, log })).get('/api/health')
    expect(res.status).toBe(503)
    expect(res.body).toEqual({ status: 'unavailable' })
    expect(res.text).not.toMatch(/127\.0\.0\.1|prisma|nobody/i)
    expect(entries.some((e) => e.level === 'error')).toBe(true)
  })
})
