import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seed } from '../../prisma/seed.js'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { cookieHeader, readSessionCookie, signIn } from '../helpers/auth.js'
import { prisma, resetDb, tableCounts } from '../helpers/db.js'
import { PROBE_PATHS, accessProbes } from '../helpers/probes.js'

// Feature-B (contracts §5): roles and ownership enforced by the server, identity only from the session.
// E-06 … E-11 are built in I-07 … I-11; until then their cells run against the I-06 probes, which use the same
// guards and ownership helpers (contracts v1.5 §5). Each of those Issues points its rows at the real path.
const app = makeApp({ extraRoutes: accessProbes(prisma) })
const SEED_PASSWORD = 'test-only-seed-password'
const VALID_EVENT = { title: 'Matrix Night', capacity: 8, startAt: '2027-01-15T10:00:00.000Z' }

type Caller = 'visitor' | 'mint' | 'quantum' | 'dragon'
const EMAIL: Record<Exclude<Caller, 'visitor'>, string> = {
  mint: 'mint@player.example',
  quantum: 'quantum@organizer.example',
  dragon: 'dragon@organizer.example',
}

const cookies = {} as Record<Exclude<Caller, 'visitor'>, string>
const ids = { ev1: 0, ev5: 0, mintReg: 0, ployReg: 0, mint: 0, ploy: 0, dragon: 0 }

async function sessionFor(email: string) {
  const res = await signIn(request(app), email, SEED_PASSWORD)
  expect(res.status).toBe(200)
  return cookieHeader(readSessionCookie(res)!.value)
}

function call(method: 'GET' | 'POST', path: string, as: Caller, body?: object) {
  let req = method === 'GET' ? request(app).get(path) : request(app).post(path).set('Origin', TEST_ORIGIN)
  if (as !== 'visitor') req = req.set('Cookie', cookies[as])
  return body === undefined ? req : req.send(body)
}

beforeAll(async () => {
  await resetDb()
  await seed(prisma, SEED_PASSWORD)
  for (const who of ['mint', 'quantum', 'dragon'] as const) cookies[who] = await sessionFor(EMAIL[who])

  const user = (email: string) => prisma.user.findUniqueOrThrow({ where: { email } })
  const event = (seedKey: string) => prisma.event.findFirstOrThrow({ where: { seedKey } })
  const [mint, ploy, dragon, ev1, ev5] = await Promise.all([
    user('mint@player.example'),
    user('ploy@player.example'),
    user('dragon@organizer.example'),
    event('EV-1'),
    event('EV-5'),
  ])
  const regOf = (participantId: number) =>
    prisma.registration.findFirstOrThrow({ where: { eventId: ev1.id, participantId } })
  Object.assign(ids, {
    ev1: ev1.id,
    ev5: ev5.id,
    mint: mint.id,
    ploy: ploy.id,
    dragon: dragon.id,
    mintReg: (await regOf(mint.id)).id,
    ployReg: (await regOf(ploy.id)).id,
  })
})
afterAll(() => prisma.$disconnect())

describe('TEST-B-01 — identity comes only from the session (AC-B-01, BR-17)', () => {
  // The "stored id = the caller" half needs the real E-06 / E-09 and is added by I-07 / I-08 (contracts v1.5).
  it.each([
    ['E-09 with participantId of another user', 'mint', (): string => PROBE_PATHS['E-09'](ids.ev5), (): object => ({ participantId: ids.ploy })],
    ['E-06 with organizerId of another organizer', 'quantum', (): string => PROBE_PATHS['E-06'], (): object => ({ ...VALID_EVENT, organizerId: ids.dragon })],
  ] as const)('%s → 400 VALIDATION_FAILED on that field, nothing stored', async (_label, as, path, body) => {
    const before = await tableCounts()
    const res = await call('POST', path(), as, body())
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual([Object.keys(body()).at(-1)])
    expect(await tableCounts()).toEqual(before)
  })
})

describe('TEST-B-02 — no session: every protected endpoint answers 401 with only an error (AC-B-02, NFR-01)', () => {
  it.each([
    ['E-02', 'POST', (): string => '/api/auth/logout'],
    ['E-03', 'GET', (): string => '/api/auth/me'],
    ['E-06', 'POST', (): string => PROBE_PATHS['E-06']],
    ['E-07', 'GET', (): string => PROBE_PATHS['E-07']],
    ['E-08', 'GET', (): string => PROBE_PATHS['E-08'](ids.ev1)],
    ['E-09', 'POST', (): string => PROBE_PATHS['E-09'](ids.ev5)],
    ['E-10', 'GET', (): string => PROBE_PATHS['E-10']],
    ['E-11', 'GET', (): string => PROBE_PATHS['E-11'](ids.mintReg)],
  ] as const)('%s → 401 UNAUTHENTICATED', async (_id, method, path) => {
    const res = await call(method, path(), 'visitor')
    expect(res.status).toBe(401)
    expect(Object.keys(res.body)).toEqual(['error'])
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
  })
})

/**
 * TEST-B-03: one row per cell of SDS §7.1 for E-01 … E-11. Columns: visitor, Mint (participant), Quantum Cards
 * (owner of EV-1), Dragon's Den (organizer, not the owner of EV-1). "Owner / not owner" only differs for E-08.
 */
type Cell = [endpoint: string, method: 'GET' | 'POST', path: () => string, as: Caller, status: number, body?: () => object]
const ANY_ORGANIZER = ['quantum', 'dragon'] as const

const MATRIX: Cell[] = [
  // E-01 sign in: everyone (a signed-in caller may sign in again).
  ['E-01', 'POST', () => '/api/auth/login', 'visitor', 200, () => ({ email: 'nok@player.example', password: SEED_PASSWORD })],
  ...(['mint', 'quantum', 'dragon'] as const).map(
    (who): Cell => ['E-01', 'POST', () => '/api/auth/login', who, 200, () => ({ email: EMAIL[who], password: SEED_PASSWORD })],
  ),
  // E-03 who am I: signed in only (E-02 sign out is checked below, so it does not end these sessions).
  ['E-03', 'GET', () => '/api/auth/me', 'visitor', 401],
  ['E-03', 'GET', () => '/api/auth/me', 'mint', 200],
  ...ANY_ORGANIZER.map((who): Cell => ['E-03', 'GET', () => '/api/auth/me', who, 200]),
  // E-04, E-05 list and detail: public.
  ...(['visitor', 'mint', 'quantum', 'dragon'] as const).flatMap((who): Cell[] => [
    ['E-04', 'GET', () => '/api/events', who, 200],
    ['E-05', 'GET', () => `/api/events/${ids.ev1}`, who, 200],
  ]),
  // E-06 create event: organizer; any organizer becomes the owner.
  ['E-06', 'POST', () => PROBE_PATHS['E-06'], 'visitor', 401, () => VALID_EVENT],
  ['E-06', 'POST', () => PROBE_PATHS['E-06'], 'mint', 403, () => VALID_EVENT],
  ...ANY_ORGANIZER.map((who): Cell => ['E-06', 'POST', () => PROBE_PATHS['E-06'], who, 201, () => VALID_EVENT]),
  // E-07 own dashboard: organizer.
  ['E-07', 'GET', () => PROBE_PATHS['E-07'], 'visitor', 401],
  ['E-07', 'GET', () => PROBE_PATHS['E-07'], 'mint', 403],
  ...ANY_ORGANIZER.map((who): Cell => ['E-07', 'GET', () => PROBE_PATHS['E-07'], who, 200]),
  // E-08 registration list of EV-1: organizer + owner; another organizer gets 404 (D-08).
  ['E-08', 'GET', () => PROBE_PATHS['E-08'](ids.ev1), 'visitor', 401],
  ['E-08', 'GET', () => PROBE_PATHS['E-08'](ids.ev1), 'mint', 403],
  ['E-08', 'GET', () => PROBE_PATHS['E-08'](ids.ev1), 'quantum', 200],
  ['E-08', 'GET', () => PROBE_PATHS['E-08'](ids.ev1), 'dragon', 404],
  // A malformed id on a protected route is checked after authentication (SDS §2.3).
  ['E-08', 'GET', () => PROBE_PATHS['E-08']('abc'), 'visitor', 401],
  ['E-08', 'GET', () => PROBE_PATHS['E-08']('abc'), 'quantum', 400],
  // E-09 register for EV-5 (owned by Dragon's Den): participant only. Quantum Cards is the wrong role AND not
  // the owner: role is checked first, so 403 (AC-B-03).
  ['E-09', 'POST', () => PROBE_PATHS['E-09'](ids.ev5), 'visitor', 401],
  ['E-09', 'POST', () => PROBE_PATHS['E-09'](ids.ev5), 'mint', 201],
  ['E-09', 'POST', () => PROBE_PATHS['E-09'](ids.ev5), 'quantum', 403],
  ['E-09', 'POST', () => PROBE_PATHS['E-09'](ids.ev5), 'dragon', 403],
  // E-10 my registrations: participant.
  ['E-10', 'GET', () => PROBE_PATHS['E-10'], 'visitor', 401],
  ['E-10', 'GET', () => PROBE_PATHS['E-10'], 'mint', 200],
  ...ANY_ORGANIZER.map((who): Cell => ['E-10', 'GET', () => PROBE_PATHS['E-10'], who, 403]),
  // E-11 one registration: participant + own; Ploy's registration is a 404 for Mint.
  ['E-11', 'GET', () => PROBE_PATHS['E-11'](ids.mintReg), 'visitor', 401],
  ['E-11', 'GET', () => PROBE_PATHS['E-11'](ids.mintReg), 'mint', 200],
  ['E-11', 'GET', () => PROBE_PATHS['E-11'](ids.ployReg), 'mint', 404],
  ...ANY_ORGANIZER.map((who): Cell => ['E-11', 'GET', () => PROBE_PATHS['E-11'](ids.mintReg), who, 403]),
]

describe('TEST-B-03 — the Sprint 1 permission matrix, cell by cell (AC-B-03, NFR-02, BR-10, BR-13, BR-14, BR-16)', () => {
  it('lists every endpoint E-01 … E-11 (E-02 is in its own case below)', () => {
    const listed = new Set(MATRIX.map(([endpoint]) => endpoint))
    expect([...listed].sort()).toEqual(['E-01', 'E-03', 'E-04', 'E-05', 'E-06', 'E-07', 'E-08', 'E-09', 'E-10', 'E-11'])
  })

  it.each(MATRIX.map((cell) => [`${cell[0]} ${cell[1]} as ${cell[3]} → ${cell[4]}`, cell] as const))(
    '%s',
    async (_name, [, method, path, as, status, body]) => {
      const res = await call(method, path(), as, body?.())
      expect(res.status).toBe(status)
      if (status >= 400) expect(Object.keys(res.body)).toEqual(['error'])
    },
  )

  it.each(['mint', 'quantum', 'dragon'] as const)('E-02 sign out as %s → 204 (its own session)', async (who) => {
    const own = await sessionFor(EMAIL[who])
    const res = await request(app).post('/api/auth/logout').set('Origin', TEST_ORIGIN).set('Cookie', own)
    expect(res.status).toBe(204)
  })

  it('404 bodies are byte-identical whether the record exists and is someone else\'s, or does not exist', async () => {
    const otherEvent = await call('GET', PROBE_PATHS['E-08'](ids.ev1), 'dragon')
    const noEvent = await call('GET', PROBE_PATHS['E-08'](999999), 'dragon')
    expect(otherEvent.status).toBe(404)
    expect(otherEvent.text).toBe(noEvent.text)

    const otherReg = await call('GET', PROBE_PATHS['E-11'](ids.ployReg), 'mint')
    const noReg = await call('GET', PROBE_PATHS['E-11'](999999), 'mint')
    expect(otherReg.status).toBe(404)
    expect(otherReg.text).toBe(noReg.text)
  })
})
