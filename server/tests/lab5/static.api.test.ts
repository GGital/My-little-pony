import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { makeApp } from '../helpers/app.js'
import { prisma } from '../helpers/db.js'

// A stand-in for client/dist, so the test does not depend on a client build having run first.
const staticDir = mkdtempSync(join(tmpdir(), 'tcg-static-'))
writeFileSync(join(staticDir, 'index.html'), '<!doctype html><html><body><div id="root"></div></body></html>')
writeFileSync(join(staticDir, 'app.js'), 'console.log("built asset")')

afterAll(() => prisma.$disconnect())

describe('TEST-L5-01 (I) — one container serves the API and the built React app (SD-01, Lab 5 R-03)', () => {
  it('serves index.html at /', async () => {
    const res = await request(makeApp({ staticDir })).get('/')
    expect(res.status).toBe(200)
    expect(res.type).toBe('text/html')
    expect(res.text).toContain('<div id="root">')
  })

  it('serves index.html for a client-side route, so a reload of /events/1 works', async () => {
    const res = await request(makeApp({ staticDir })).get('/events/1')
    expect(res.status).toBe(200)
    expect(res.text).toContain('<div id="root">')
  })

  it('serves a built asset as itself, not as index.html', async () => {
    const res = await request(makeApp({ staticDir })).get('/app.js')
    expect(res.status).toBe(200)
    expect(res.type).toBe('application/javascript')
    expect(res.text).toContain('built asset')
  })

  it('keeps an unknown /api path as the JSON 404, never the page', async () => {
    const res = await request(makeApp({ staticDir })).get('/api/nope')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'There is nothing here.' } })
  })
})
