import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CONFIG_KEYS, TOOL_KEYS, loadConfig } from '../../../src/config.js'

const serverDir = fileURLToPath(new URL('../../../', import.meta.url))
const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8')

/** Keys assigned in server/.env.example (`NAME=...` lines). */
function envExampleKeys() {
  return [...read('../../../.env.example').matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]).sort()
}

/** Keys listed in the SDS §9.1 table (rows that start with "| `NAME`"). */
function sdsKeys() {
  const sds = read('../../../../docs/system-sds.md')
  const section = sds.slice(sds.indexOf('### 9.1'), sds.indexOf('### 9.2'))
  return [...section.matchAll(/^\| `([A-Z][A-Z0-9_]*)` \|/gm)].map((m) => m[1]).sort()
}

const VALID = {
  DATABASE_URL: 'postgresql://user:not-a-real-password@localhost:5432/tcg_event_hub',
  APP_ORIGIN: 'http://localhost:5173',
}

describe('TEST-SR4-01 (U) — configuration is complete and checked at start-up (NFR-13)', () => {
  it('.env.example, the SDS §9.1 table and config.ts name the same variables', () => {
    const expected = [...CONFIG_KEYS, ...TOOL_KEYS].sort()
    expect(expected.length).toBe(8)
    expect(envExampleKeys()).toEqual(expected)
    expect(sdsKeys()).toEqual(expected)
  })

  it('reads a valid environment into typed values, with defaults for the optional ones', () => {
    expect(loadConfig({ ...VALID })).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: VALID.DATABASE_URL,
      APP_ORIGIN: VALID.APP_ORIGIN,
      LOG_LEVEL: 'info',
      TRUST_PROXY: 0,
    })
    expect(loadConfig({ ...VALID, PORT: '8080', NODE_ENV: 'production', TRUST_PROXY: '1' })).toMatchObject({
      PORT: 8080,
      NODE_ENV: 'production',
      TRUST_PROXY: 1,
    })
  })

  it.each(['DATABASE_URL', 'APP_ORIGIN'] as const)('throws naming %s when it is missing or empty', (key) => {
    expect(() => loadConfig({ ...VALID, [key]: undefined })).toThrow(new RegExp(`${key} is required`))
    expect(() => loadConfig({ ...VALID, [key]: '' })).toThrow(new RegExp(`${key} is required`))
  })

  it('rejects malformed values without echoing them (they may be secrets)', () => {
    const bad = () => loadConfig({ ...VALID, DATABASE_URL: 'mysql://root:hunter2-secret@db/x' })
    expect(bad).toThrow(/DATABASE_URL/)
    expect(bad).not.toThrow(/hunter2-secret/)
    expect(() => loadConfig({ ...VALID, APP_ORIGIN: 'http://localhost:5173/app' })).toThrow(/APP_ORIGIN/)
    expect(() => loadConfig({ ...VALID, PORT: 'eighty' })).toThrow(/PORT/)
  })

  it('the real server refuses to start without DATABASE_URL and says why', () => {
    const run = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
      cwd: serverDir,
      env: { PATH: process.env.PATH, NODE_ENV: 'production', APP_ORIGIN: VALID.APP_ORIGIN, PORT: '0' },
      encoding: 'utf8',
      timeout: 20_000,
    })
    expect(run.status).toBe(1)
    expect(run.stderr).toMatch(/DATABASE_URL is required/)
    expect(run.stderr).not.toMatch(/\n\s+at /) // a clear message, not a stack trace
  })
})
