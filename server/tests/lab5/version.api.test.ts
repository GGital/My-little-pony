import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { loadConfig } from '../../src/config.js'
import { makeApp, TEST_ORIGIN } from '../helpers/app.js'
import { prisma } from '../helpers/db.js'

const SHA = '0123456789abcdef0123456789abcdef01234567'
const configWith = (env: Record<string, string>) =>
  loadConfig({ ...process.env, APP_ORIGIN: TEST_ORIGIN, LOG_LEVEL: 'silent', ...env })

afterAll(() => prisma.$disconnect())

// Lab 5 R-08: the running commit can be read from the live URL; the deploy smoke test compares it with the image tag.
describe('TEST-L5-05 (I) — GET /api/version names the commit the image was built from', () => {
  it('answers {commit} with the full GIT_SHA of the image', async () => {
    const res = await request(makeApp({ config: configWith({ GIT_SHA: SHA }) })).get('/api/version')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ commit: SHA })
  })

  it('answers {commit:"local"} outside a pipeline build', async () => {
    const env = { ...process.env, APP_ORIGIN: TEST_ORIGIN, LOG_LEVEL: 'silent' }
    delete env.GIT_SHA
    const res = await request(makeApp({ config: loadConfig(env) })).get('/api/version')
    expect(res.body).toEqual({ commit: 'local' })
  })
})
