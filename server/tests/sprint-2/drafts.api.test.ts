import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seed } from '../../prisma/seed.js'
import { resetNow, setNow } from '../../src/clock.js'
import { TEST_ORIGIN, makeApp } from '../helpers/app.js'
import { cookieHeader, readSessionCookie, signIn } from '../helpers/auth.js'
import { prisma, resetDb, tableCounts } from '../helpers/db.js'

// Feature-K drafts: E-06 saveAsDraft, E-14 POST /api/organizer/events/:id/publish, and drafts hidden from
// E-04, E-05 and E-09 (Sprint 2 contracts §2, v0.6 with CH-13). STS §2.2 TEST-K-01 … 05.
const app = makeApp()
const SEED_PASSWORD = 'test-only-seed-password'
const T = new Date('2030-03-01T08:00:00.000Z')
const MIN = 60_000
const at = (base: Date | string, minutes: number) => new Date(new Date(base).getTime() + minutes * MIN)

const cookies = { quantum: '', dragon: '', mint: '', nok: '' }
let quantumId = 0
let n = 0

async function sessionFor(email: string) {
  const res = await signIn(request(app), email, SEED_PASSWORD)
  expect(res.status).toBe(200)
  return cookieHeader(readSessionCookie(res)!.value)
}

/** A valid E-06 body starting `startIn` minutes after the clock, 4 hours long, with a unique title. */
function body(startIn = 2 * 24 * 60, extra: Record<string, unknown> = {}) {
  const startAt = at(T, startIn)
  return {
    title: `Draft Night ${++n}`,
    type: 'CASUAL',
    format: 'CONSTRUCTED',
    venueName: 'Quantum Cards',
    venueAddress: '1631 Kanchanaphisek Rd',
    city: 'Bangkok',
    startAt: startAt.toISOString(),
    endAt: at(startAt, 4 * 60).toISOString(),
    capacity: 24,
    ...extra,
  }
}

const post = (path: string, cookie?: string, origin: string | null = TEST_ORIGIN) => {
  let req = request(app).post(path)
  if (cookie) req = req.set('Cookie', cookie)
  if (origin) req = req.set('Origin', origin)
  return req
}
const get = (path: string, cookie?: string) => (cookie ? request(app).get(path).set('Cookie', cookie) : request(app).get(path))
const E14 = (id: number | string) => `/api/organizer/events/${id}/publish`

/** E-06 by Quantum Cards with saveAsDraft, on the clock as it is now. */
async function createDraft(startIn?: number) {
  const res = await post('/api/events', cookies.quantum).send(body(startIn, { saveAsDraft: true }))
  expect(res.status).toBe(201)
  return res.body as { id: number; title: string; startAt: string }
}

/** Read straight from the table, independently of the code under test (STS §1.1 rule 2). */
const storedChanges = (eventId: number) => prisma.$queryRaw<
  { field: string; oldValue: string | null; newValue: string; changedById: number; changedAt: Date }[]
>`SELECT "field"::text AS field, "oldValue", "newValue", "changedById", "changedAt"
  FROM "EventChange" WHERE "eventId" = ${eventId} ORDER BY id`

const listIds = async (query: string, cookie?: string) =>
  ((await get(`/api/events${query}`, cookie)).body.items as { id: number }[]).map((e) => e.id)

beforeAll(async () => {
  await resetDb()
  await seed(prisma, SEED_PASSWORD)
  setNow(T)
  cookies.quantum = await sessionFor('quantum@organizer.example')
  cookies.dragon = await sessionFor('dragon@organizer.example')
  cookies.mint = await sessionFor('mint@player.example')
  cookies.nok = await sessionFor('nok@player.example')
  quantumId = (await prisma.user.findUniqueOrThrow({ where: { email: 'quantum@organizer.example' } })).id
})
afterAll(async () => {
  resetNow()
  await prisma.$disconnect()
})

describe('TEST-K-01 (I) saving a draft (AC-K-01, FR-08)', () => {
  it('E-06 with saveAsDraft: 201 DRAFT, publishedAt null, one change row null → DRAFT; E-07 lists it; E-05 gives MANAGE', async () => {
    setNow(T)
    const res = await post('/api/events', cookies.quantum).send(body(undefined, { saveAsDraft: true }))
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('DRAFT')

    const row = await prisma.event.findUniqueOrThrow({ where: { id: res.body.id } })
    expect([row.status, row.publishedAt, row.organizerId]).toEqual(['DRAFT', null, quantumId])
    expect(await storedChanges(row.id)).toEqual([
      { field: 'status', oldValue: null, newValue: 'DRAFT', changedById: quantumId, changedAt: T },
    ])

    const dashboard = await get('/api/organizer/events', cookies.quantum)
    expect(dashboard.body.items).toContainEqual(expect.objectContaining({ id: row.id, status: 'DRAFT' }))

    const detail = await get(`/api/events/${row.id}`, cookies.quantum)
    expect(detail.status).toBe(200)
    expect(detail.body).toMatchObject({ id: row.id, status: 'DRAFT', viewer: { action: 'MANAGE' } })
  })

  it('E-06 without saveAsDraft still publishes at once (Sprint 1 behaviour unchanged)', async () => {
    setNow(T)
    const res = await post('/api/events', cookies.quantum).send(body())
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('PUBLISHED')
    expect((await storedChanges(res.body.id)).map((c) => c.newValue)).toEqual(['PUBLISHED'])
  })
})

describe('TEST-K-02 (I) a draft is invisible to everyone but its owner (AC-K-02, BR-04)', () => {
  let draft: { id: number; title: string }
  beforeAll(async () => {
    setNow(T)
    draft = await createDraft()
  })

  it.each([
    ['a visitor', undefined],
    ['Nok (participant)', 'nok'],
    ["Dragon's Den (another organizer)", 'dragon'],
  ] as const)('%s: E-04 never lists it, E-05 is the same 404 as a missing id', async (_who, key) => {
    const cookie = key ? cookies[key] : undefined
    for (const query of ['', '?include=past,cancelled', `?q=${encodeURIComponent(draft.title)}`]) {
      expect(await listIds(query, cookie), query || 'no filter').not.toContain(draft.id)
    }
    const hidden = await get(`/api/events/${draft.id}`, cookie)
    const missing = await get('/api/events/999999', cookie)
    expect(hidden.status).toBe(404)
    expect(hidden.body.error.code).toBe('EVENT_NOT_FOUND')
    expect(hidden.text).toBe(missing.text)
  })

  it('E-09 by Nok is 404 EVENT_NOT_FOUND and stores no registration', async () => {
    const res = await post(`/api/events/${draft.id}/registrations`, cookies.nok).send({})
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('EVENT_NOT_FOUND')
    expect(await prisma.registration.count({ where: { eventId: draft.id } })).toBe(0)
  })
})

describe('TEST-K-03 (I) publishing a draft (AC-K-03, FR-08, FR-28)', () => {
  it('E-14 by the owner: 200 PUBLISHED, publishedAt = T, change row DRAFT → PUBLISHED; E-04 now lists it', async () => {
    setNow(at(T, -24 * 60))
    const draft = await createDraft(3 * 24 * 60)
    setNow(T)

    const res = await post(E14(draft.id), cookies.quantum).send({})
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: draft.id, status: 'PUBLISHED', viewer: { action: 'MANAGE' } })

    const row = await prisma.event.findUniqueOrThrow({ where: { id: draft.id } })
    expect([row.status, row.publishedAt]).toEqual(['PUBLISHED', T])
    expect((await storedChanges(draft.id)).map((c) => [c.oldValue, c.newValue, c.changedById, c.changedAt])).toEqual([
      [null, 'DRAFT', quantumId, at(T, -24 * 60)],
      ['DRAFT', 'PUBLISHED', quantumId, T],
    ])
    expect(await listIds('')).toContain(draft.id)
  })

  it('accepts a request with no body at all (contract: body {} or none)', async () => {
    setNow(T)
    const draft = await createDraft()
    const res = await post(E14(draft.id), cookies.quantum)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('PUBLISHED')
  })
})

describe('TEST-K-04 (I) publishing re-checks the time rules; published and cancelled events are refused (AC-K-04, D-21)', () => {
  /** E-14 must change nothing: same row, same number of change rows. */
  async function expectRefused(id: number, status: number, code: string, field?: string) {
    const rowBefore = await prisma.event.findUniqueOrThrow({ where: { id } })
    const changesBefore = await prisma.eventChange.count()
    const res = await post(E14(id), cookies.quantum).send({})
    expect(res.status).toBe(status)
    expect(res.body.error.code).toBe(code)
    if (field) expect(res.body.error.details).toEqual([expect.objectContaining({ field })])
    expect(await prisma.event.findUniqueOrThrow({ where: { id } })).toEqual(rowBefore)
    expect(await prisma.eventChange.count()).toBe(changesBefore)
  }

  it('a draft whose start has passed (clock moved): 422 on startAt, still DRAFT', async () => {
    setNow(T)
    const draft = await createDraft(60)
    setNow(at(draft.startAt, 60))
    await expectRefused(draft.id, 422, 'EVENT_TIME_INVALID', 'startAt')
  })

  it('a draft starting in 30 minutes: 422 on startAt (CH-13); in exactly 60 minutes: 200', async () => {
    setNow(T)
    const soon = await createDraft(24 * 60)
    const onTheHour = await createDraft(24 * 60)

    setNow(at(soon.startAt, -30))
    await expectRefused(soon.id, 422, 'EVENT_TIME_INVALID', 'startAt')

    setNow(at(onTheHour.startAt, -60))
    const res = await post(E14(onTheHour.id), cookies.quantum).send({})
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('PUBLISHED')
  })

  it('a published event: 409 ALREADY_PUBLISHED; a cancelled one: 409 ALREADY_CANCELLED', async () => {
    setNow(T)
    const published = await post('/api/events', cookies.quantum).send(body())
    expect(published.status).toBe(201)
    await expectRefused(published.body.id, 409, 'ALREADY_PUBLISHED')

    const cancelled = await post('/api/events', cookies.quantum).send(body())
    await prisma.event.update({
      where: { id: cancelled.body.id },
      data: { status: 'CANCELLED', cancelledAt: T, cancelledById: quantumId, cancelReason: 'Store closed.' },
    })
    await expectRefused(cancelled.body.id, 409, 'ALREADY_CANCELLED')
  })
})

describe('TEST-K-05 (I) who may save and publish drafts (AC-K-05, BR-13, BR-17)', () => {
  let draft: { id: number }
  beforeAll(async () => {
    setNow(T)
    draft = await createDraft()
  })

  it("E-14 by Dragon's Den 404 (same as a missing id), Mint 403, a visitor 401, a foreign Origin 403, bad ids and bodies 400; nothing changes", async () => {
    const before = await tableCounts()
    const changes = await prisma.eventChange.count()

    const other = await post(E14(draft.id), cookies.dragon).send({})
    const missing = await post(E14(999999), cookies.dragon).send({})
    expect([other.status, other.body.error.code]).toEqual([404, 'EVENT_NOT_FOUND'])
    expect(other.text).toBe(missing.text)

    const results = await Promise.all([
      post(E14(draft.id), cookies.mint).send({}),
      post(E14(draft.id)).send({}),
      post(E14(draft.id), cookies.quantum, 'https://evil.example').send({}),
      post(E14('abc'), cookies.quantum).send({}),
      post(E14(draft.id), cookies.quantum).send({ status: 'PUBLISHED' }),
    ])
    expect(results.map((r) => [r.status, r.body.error.code])).toEqual([
      [403, 'FORBIDDEN'],
      [401, 'UNAUTHENTICATED'],
      [403, 'FORBIDDEN'],
      [400, 'INVALID_PATH_PARAMETER'],
      [400, 'VALIDATION_FAILED'],
    ])

    expect(await tableCounts()).toEqual(before)
    expect(await prisma.eventChange.count()).toBe(changes)
    expect((await prisma.event.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe('DRAFT')
  })

  it('E-06 by Mint with saveAsDraft is 403; saveAsDraft "yes" and status "DRAFT" are 400; nothing is stored', async () => {
    const before = await tableCounts()
    const mint = await post('/api/events', cookies.mint).send(body(undefined, { saveAsDraft: true }))
    const notBoolean = await post('/api/events', cookies.quantum).send(body(undefined, { saveAsDraft: 'yes' }))
    const status = await post('/api/events', cookies.quantum).send(body(undefined, { status: 'DRAFT' }))

    expect([mint.status, mint.body.error.code]).toEqual([403, 'FORBIDDEN'])
    expect(notBoolean.status).toBe(400)
    expect(notBoolean.body.error.details).toEqual([expect.objectContaining({ field: 'saveAsDraft' })])
    expect(status.status).toBe(400)
    expect(status.body.error.details).toEqual([expect.objectContaining({ field: 'status' })])
    expect(await tableCounts()).toEqual(before)
  })
})
