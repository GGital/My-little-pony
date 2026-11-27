import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seed } from '../../prisma/seed.js'
import { resetNow, setNow } from '../../src/clock.js'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { cookieHeader, readSessionCookie, signIn } from '../helpers/auth.js'
import { DAY, HOUR, makeEvent, prisma, resetDb } from '../helpers/db.js'

// Feature-U (CH-11, D-37): game per event, store games, store contact (Sprint 2 contracts §11.1). STS §2.8.
// TEST-U-01 (E-06, E-13), TEST-U-03 (E-23 games), TEST-U-04 (E-23 contact, E-05), TEST-U-05 (E-23 validation) here;
// the E-04 filter (TEST-U-02) is in search.api.test.ts and the pure rules in unit/store-contact.unit.test.ts.
const app = makeApp()
const SEED_PASSWORD = 'test-only-seed-password'
const T = new Date('2030-03-01T08:00:00.000Z')
const E23 = '/api/organizer/store'

const cookies = { quantum: '', dragon: '', mint: '' }
let quantumId = 0
let n = 0

async function sessionFor(email: string) {
  const res = await signIn(request(app), email, SEED_PASSWORD)
  expect(res.status).toBe(200)
  return cookieHeader(readSessionCookie(res)!.value)
}

/** A valid E-06 body, 2 days after the clock, with a unique title. */
function createBody(extra: Record<string, unknown> = {}) {
  const startAt = new Date(T.getTime() + 2 * DAY)
  return {
    title: `Game Night ${++n}`,
    type: 'CASUAL',
    format: 'CONSTRUCTED',
    venueName: 'Quantum Cards',
    venueAddress: '1631 Kanchanaphisek Rd',
    city: 'Bangkok',
    startAt: startAt.toISOString(),
    endAt: new Date(startAt.getTime() + 4 * HOUR).toISOString(),
    capacity: 24,
    ...extra,
  }
}
const e06 = (body: object, cookie: string | undefined = cookies.quantum) => {
  let req = request(app).post('/api/events').set('Origin', TEST_ORIGIN)
  if (cookie) req = req.set('Cookie', cookie)
  return req.send(body)
}
const e13 = (id: number, body: object) =>
  request(app).patch(`/api/organizer/events/${id}`).set('Origin', TEST_ORIGIN).set('Cookie', cookies.quantum).send(body)
const e23 = (body: object, cookie: string | undefined = cookies.quantum, origin: string | null = TEST_ORIGIN) => {
  let req = request(app).patch(E23)
  if (cookie) req = req.set('Cookie', cookie)
  if (origin) req = req.set('Origin', origin)
  return req.send(body)
}
const e05 = (id: number, cookie?: string) => {
  const req = request(app).get(`/api/events/${id}`)
  return cookie ? req.set('Cookie', cookie) : req
}
const storedStore = () =>
  prisma.user.findUniqueOrThrow({
    where: { id: quantumId },
    select: { games: true, contactPhone: true, contactEmail: true, contactWebsite: true, contactLine: true },
  })
const NO_CONTACT = { contactPhone: null, contactEmail: null, contactWebsite: null, contactLine: null }
const resetStore = () => prisma.user.update({ where: { id: quantumId }, data: { games: [], ...NO_CONTACT } })

beforeAll(async () => {
  await resetDb()
  await seed(prisma, SEED_PASSWORD)
  setNow(T)
  cookies.quantum = await sessionFor('quantum@organizer.example')
  cookies.dragon = await sessionFor('dragon@organizer.example')
  cookies.mint = await sessionFor('mint@player.example')
  quantumId = (await prisma.user.findUniqueOrThrow({ where: { email: 'quantum@organizer.example' } })).id
})
afterAll(async () => {
  resetNow()
  await prisma.$disconnect()
})

describe('TEST-U-01 (I) game on create and edit (AC-U-01, FR-29)', () => {
  it('E-06 with game POKEMON: 201 and game POKEMON stored', async () => {
    const res = await e06(createBody({ game: 'POKEMON' }))
    expect(res.status).toBe(201)
    expect(res.body.game).toBe('POKEMON')
    expect((await prisma.event.findUniqueOrThrow({ where: { id: res.body.id } })).game).toBe('POKEMON')
  })

  it('E-06 without game: 201 and game OTHER (Sprint 1 bodies stay valid)', async () => {
    const res = await e06(createBody())
    expect(res.status).toBe(201)
    expect(res.body.game).toBe('OTHER')
    expect((await prisma.event.findUniqueOrThrow({ where: { id: res.body.id } })).game).toBe('OTHER')
  })

  it('E-06 with game CHESS: 400 on game and nothing stored', async () => {
    const before = await prisma.event.count()
    const res = await e06(createBody({ game: 'CHESS' }))
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain('game')
    expect(await prisma.event.count()).toBe(before)
  })

  it('E-13 game MAGIC: 200, stored, and one details change row naming game', async () => {
    const event = await makeEvent(quantumId, { startAt: new Date(T.getTime() + 2 * DAY) })
    const res = await e13(event.id, { game: 'MAGIC' })
    expect(res.status).toBe(200)
    expect(res.body.game).toBe('MAGIC')
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).game).toBe('MAGIC')
    const rows = await prisma.$queryRaw<{ field: string; newValue: string }[]>`
      SELECT "field"::text AS field, "newValue" FROM "EventChange" WHERE "eventId" = ${event.id} AND "field"::text = 'details'`
    expect(rows).toHaveLength(1)
    expect(rows[0]?.newValue).toContain('game')
  })

  it('E-13 game CHESS: 400 on game', async () => {
    const event = await makeEvent(quantumId, { startAt: new Date(T.getTime() + 2 * DAY) })
    const res = await e13(event.id, { game: 'CHESS' })
    expect(res.status).toBe(400)
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain('game')
  })

  it('E-05 and E-04 summaries carry game and store { displayName, logoUrl }', async () => {
    const created = await e06(createBody({ game: 'LORCANA' }))
    const detail = await e05(created.body.id)
    expect(detail.body.game).toBe('LORCANA')
    expect(detail.body.store).toMatchObject({ displayName: 'Quantum Cards', logoUrl: null })
    const list = await request(app).get('/api/events?game=LORCANA')
    expect(list.body.items).toContainEqual(
      expect.objectContaining({ id: created.body.id, game: 'LORCANA', store: { displayName: 'Quantum Cards', logoUrl: null } }),
    )
  })
})

describe('TEST-U-03 (I) the store profile games (AC-U-03, FR-30, BR-17, NFR-02)', () => {
  it('E-23 { games: [POKEMON, MAGIC] }: 200, stored, and E-05 of a Quantum Cards event shows both', async () => {
    await resetStore()
    const event = await makeEvent(quantumId, { startAt: new Date(T.getTime() + 2 * DAY) })
    const res = await e23({ games: ['POKEMON', 'MAGIC'] })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ displayName: 'Quantum Cards', games: ['POKEMON', 'MAGIC'] })
    expect((await storedStore()).games).toEqual(['POKEMON', 'MAGIC'])
    expect((await e05(event.id)).body.store.games).toEqual(['POKEMON', 'MAGIC'])
  })

  it('GET /api/organizer/store returns the caller’s own { displayName, games, contact }', async () => {
    await e23({ games: ['YUGIOH'] })
    const res = await request(app).get(E23).set('Cookie', cookies.quantum)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      displayName: 'Quantum Cards',
      games: ['YUGIOH'],
      contact: { phone: null, email: null, website: null, line: null },
    })
  })

  it('E-23 { games: [] }: 200 with no games', async () => {
    const res = await e23({ games: [] })
    expect(res.status).toBe(200)
    expect(res.body.games).toEqual([])
    expect((await storedStore()).games).toEqual([])
  })

  it('E-23 with a duplicate game, an unknown game, or more than 7: 400 on games and nothing changes', async () => {
    await e23({ games: ['LORCANA'] })
    for (const games of [['POKEMON', 'POKEMON'], ['X'], ['POKEMON', 'MAGIC', 'ONE_PIECE', 'YUGIOH', 'DIGIMON', 'LORCANA', 'OTHER', 'OTHER']]) {
      const res = await e23({ games })
      expect(res.status).toBe(400)
      expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain('games')
    }
    expect((await storedStore()).games).toEqual(['LORCANA'])
  })

  it('E-23 by Mint (participant) 403, by a visitor 401', async () => {
    expect((await e23({ games: ['POKEMON'] }, cookies.mint)).status).toBe(403)
    expect((await e23({ games: ['POKEMON'] }, '')).status).toBe(401)
    expect((await request(app).get(E23)).status).toBe(401)
    expect((await request(app).get(E23).set('Cookie', cookies.mint)).status).toBe(403)
  })

  it('E-23 edits only the caller’s own store: Dragon’s games are untouched', async () => {
    const dragon = await prisma.user.findUniqueOrThrow({ where: { email: 'dragon@organizer.example' } })
    const before = dragon.games
    await e23({ games: ['DIGIMON'] })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: dragon.id } })).games).toEqual(before)
  })
})

describe('TEST-U-04 (I) the store contact on every event (AC-U-04, FR-30, D-37, D-14)', () => {
  it('E-23 contact: 200, email trimmed and lower-case; A and B carry the same store.contact; B keeps its own contact', async () => {
    await resetStore()
    const a = await makeEvent(quantumId, { startAt: new Date(T.getTime() + 2 * DAY) })
    const b = await makeEvent(quantumId, { startAt: new Date(T.getTime() + 3 * DAY) })
    await prisma.event.update({ where: { id: a.id }, data: { contact: null } })
    await prisma.event.update({ where: { id: b.id }, data: { contact: 'Ask for Ken at the counter' } })

    const res = await e23({
      contactPhone: '02 555 0101',
      contactEmail: ' Hello@QuantumCards.example ',
      contactWebsite: 'https://quantumcards.example/events',
      contactLine: '@quantumcards',
    })
    expect(res.status).toBe(200)
    const expected = {
      phone: '02 555 0101',
      email: 'hello@quantumcards.example',
      website: 'https://quantumcards.example/events',
      line: '@quantumcards',
    }
    expect(res.body.contact).toEqual(expected)
    expect((await storedStore()).contactEmail).toBe('hello@quantumcards.example')

    const ra = await e05(a.id)
    const rb = await e05(b.id)
    expect(ra.body.store.contact).toEqual(expected)
    expect(rb.body.store.contact).toEqual(expected)
    expect(ra.body.contact).toBeNull()
    expect(rb.body.contact).toBe('Ask for Ken at the counter')
    // D-14 / NFR-02: the organizer's sign-in email is in neither response.
    for (const r of [ra, rb]) expect(JSON.stringify(r.body)).not.toContain('quantum@organizer.example')

    const cleared = await e23({ contactLine: '' })
    expect(cleared.status).toBe(200)
    expect(cleared.body.contact.line).toBeNull()
    expect((await storedStore()).contactLine).toBeNull()
    expect((await e05(a.id)).body.store.contact).toEqual({ ...expected, line: null })
  })

  it('an unset field is null and a partial PATCH keeps the other fields', async () => {
    await resetStore()
    await e23({ contactPhone: '02 555 0101' })
    const res = await e23({ contactWebsite: 'http://quantumcards.example' })
    expect(res.body.contact).toEqual({ phone: '02 555 0101', email: null, website: 'http://quantumcards.example', line: null })
  })

  it('a LINE ID without @ is accepted', async () => {
    const res = await e23({ contactLine: 'quantum.cards-1' })
    expect(res.status).toBe(200)
    expect(res.body.contact.line).toBe('quantum.cards-1')
  })
})

describe('TEST-U-05 (I) contact validation (AC-U-05, NFR-15)', () => {
  it('E-23 with every field wrong: 400 listing every failing field with the contract messages, nothing stored', async () => {
    await resetStore()
    const res = await e23({
      contactPhone: 'abc',
      contactEmail: 'hello@',
      contactWebsite: 'javascript:alert(1)',
      contactLine: 'my line id',
    })
    expect(res.status).toBe(400)
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        { field: 'contactPhone', message: 'Enter a phone number, for example 02 555 0101.' },
        { field: 'contactEmail', message: 'Enter an email address, for example hello@store.example.' },
        { field: 'contactWebsite', message: 'Enter a web address starting with https://.' },
        { field: 'contactLine', message: 'Enter a LINE ID, for example @quantumcards.' },
      ]),
    )
    expect(res.body.error.details).toHaveLength(4)
    expect(await storedStore()).toEqual({ games: [], ...NO_CONTACT })
  })

  it('E-23 website ftp:// and a 201-character website: 400 on contactWebsite', async () => {
    for (const contactWebsite of ['ftp://store.example', `https://${'a'.repeat(189)}.com`]) {
      expect([19, 201]).toContain(contactWebsite.length)
      const res = await e23({ contactWebsite })
      expect(res.status).toBe(400)
      expect(res.body.error.details).toEqual([
        { field: 'contactWebsite', message: 'Enter a web address starting with https://.' },
      ])
    }
    expect(await storedStore()).toEqual({ games: [], ...NO_CONTACT })
  })

  it('E-23 {}: 400 "Change at least one field."', async () => {
    const res = await e23({})
    expect(res.status).toBe(400)
    expect(JSON.stringify(res.body.error)).toContain('Change at least one field.')
  })

  it('E-23 phone with fewer than 9 digits: 400; E-23 with a wrong Origin: 403; a non-JSON body: 415', async () => {
    expect((await e23({ contactPhone: '(02) 555-01' })).status).toBe(400)
    expect((await e23({ games: [] }, cookies.quantum, 'https://evil.example')).status).toBe(403)
    const res = await request(app).patch(E23).set('Origin', TEST_ORIGIN).set('Cookie', cookies.quantum).set('Content-Type', 'text/plain').send('x')
    expect(res.status).toBe(415)
  })
})

// TEST-B-03 rows (E-23), SDS §7.1. TEST-SR2-03 has its route row in server/tests/helpers/routes.ts.
describe('TEST-B-03 rows (E-23) GET and PATCH /api/organizer/store', () => {
  it('visitor 401; Mint 403; Quantum Cards 200 on both methods', async () => {
    expect((await request(app).get(E23)).status).toBe(401)
    expect((await e23({ games: [] }, '')).status).toBe(401)
    expect((await request(app).get(E23).set('Cookie', cookies.mint)).status).toBe(403)
    expect((await e23({ games: [] }, cookies.mint)).status).toBe(403)
    expect((await request(app).get(E23).set('Cookie', cookies.quantum)).status).toBe(200)
    expect((await e23({ games: [] })).status).toBe(200)
  })
})
