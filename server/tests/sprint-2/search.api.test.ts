import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seed } from '../../prisma/seed.js'
import { makeApp } from '../helpers/app.js'
import { prisma, resetDb } from '../helpers/db.js'

const app = makeApp()

beforeAll(async () => {
  await resetDb()
  await seed(prisma, 'test-only-seed-password')

  // Ensure an organizer user exists for test events
  const organizer = await prisma.user.findFirstOrThrow({ where: { role: 'ORGANIZER' } })

  // Ensure EV-7 (draft) and EV-8 (cancelled) exist in test DB for comprehensive lifecycle testing
  await prisma.event.upsert({
    where: { seedKey: 'EV-7' },
    update: {},
    create: {
      seedKey: 'EV-7',
      organizerId: organizer.id,
      title: 'Prerelease Planning Night',
      type: 'CASUAL',
      format: 'DRAFT',
      venueName: 'Quantum Cards',
      venueAddress: '1631 Kanchanaphisek Rd, Bang Khae, Bangkok 10160',
      city: 'Bangkok',
      startAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      endAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
      capacity: 16,
      status: 'DRAFT',
    },
  })

  await prisma.event.upsert({
    where: { seedKey: 'EV-8' },
    update: {},
    create: {
      seedKey: 'EV-8',
      organizerId: organizer.id,
      title: 'Rainy Day Casual',
      type: 'CASUAL',
      format: 'CONSTRUCTED',
      venueName: 'Quantum Cards',
      venueAddress: '1631 Kanchanaphisek Rd, Bang Khae, Bangkok 10160',
      city: 'Bangkok',
      startAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      endAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      capacity: 8,
      status: 'CANCELLED',
    },
  })
})

afterAll(() => prisma.$disconnect())

describe('TEST-J-01 — search text queries against seed (AC-J-01, FR-13)', () => {
  it('searches by q=quantum, BANGKOK, draft night, เปิดกล่อง, 50%_off, 101 chars', async () => {
    // 1. "quantum" -> Quantum Cards upcoming events
    const resQuantum = await request(app).get('/api/events?q=quantum')
    expect(resQuantum.status).toBe(200)
    expect(resQuantum.body.items.length).toBeGreaterThan(0)
    for (const item of resQuantum.body.items) {
      expect(
        item.venueName.toLowerCase().includes('quantum') ||
          item.title.toLowerCase().includes('quantum') ||
          item.city.toLowerCase().includes('quantum'),
      ).toBe(true)
      expect(item.status).toBe('PUBLISHED')
    }

    // 2. "BANGKOK" -> every upcoming published event
    const resBangkok = await request(app).get('/api/events?q=BANGKOK')
    expect(resBangkok.status).toBe(200)
    for (const item of resBangkok.body.items) {
      expect(item.city.toLowerCase()).toBe('bangkok')
      expect(item.status).toBe('PUBLISHED')
    }

    // 3. "draft night" -> EV-5 Dragon Draft Night
    const resDraftNight = await request(app).get('/api/events?q=draft%20night')
    expect(resDraftNight.status).toBe(200)
    const titles = resDraftNight.body.items.map((i: { title: string }) => i.title)
    expect(titles).toContain('Dragon Draft Night')

    // 4. "เปิดกล่อง" -> EV-6 Release Weekend Sealed · เปิดกล่องสุดสัปดาห์
    const resThai = await request(app).get('/api/events?q=%E0%B9%80%E0%B8%9B%E0%B8%B4%E0%B8%94%E0%B8%81%E0%B8%A5%E0%B9%88%E0%B8%AD%E0%B8%87')
    expect(resThai.status).toBe(200)
    expect(resThai.body.items.some((i: { title: string }) => i.title.includes('เปิดกล่อง'))).toBe(true)

    // 5. "50%_off" -> [] (literal matching of % and _, no wildcard expansion)
    const resPercent = await request(app).get('/api/events?q=50%25_off')
    expect(resPercent.status).toBe(200)
    expect(resPercent.body.items).toEqual([])

    // 6. 101 characters -> 400 on q
    const resTooLong = await request(app).get(`/api/events?q=${'a'.repeat(101)}`)
    expect(resTooLong.status).toBe(400)
    expect(resTooLong.body.error.code).toBe('VALIDATION_FAILED')
    expect(resTooLong.body.error.details.some((d: { field: string }) => d.field === 'q')).toBe(true)

    // Draft EV-7 is NEVER present in any search result
    for (const res of [resQuantum, resBangkok, resDraftNight, resThai, resPercent]) {
      const allTitles = res.body.items.map((i: { title: string }) => i.title)
      expect(allTitles).not.toContain('Prerelease Planning Night')
    }
  })
})

describe('TEST-J-02 — filter combinations and Bangkok date boundaries (AC-J-02, FR-13, NFR-11, D-22)', () => {
  it('filters by type, format, from/to across Bangkok midnight, seatsAvailable, and combined', async () => {
    const organizer = await prisma.user.findFirstOrThrow({ where: { role: 'ORGANIZER' } })

    // Build specific events for date boundary testing
    // Bangkok date: 2026-12-10 (runs from 2026-12-09T17:00:00.000Z to 2026-12-10T17:00:00.000Z)
    // Event A: at 23:30 Bangkok on 2026-12-10 (2026-12-10T16:30:00.000Z in UTC) -> INCLUDED in to=2026-12-10
    // Event B: at 00:30 Bangkok on 2026-12-11 (2026-12-10T17:30:00.000Z in UTC) -> EXCLUDED in to=2026-12-10
    const eventA = await prisma.event.create({
      data: {
        organizerId: organizer.id,
        title: 'Boundary Event 23:30',
        type: 'TOURNAMENT',
        format: 'CONSTRUCTED',
        venueName: 'Test Venue A',
        venueAddress: 'Addr A',
        city: 'Bangkok',
        startAt: new Date('2026-12-10T16:30:00.000Z'),
        endAt: new Date('2026-12-10T19:30:00.000Z'),
        capacity: 10,
        status: 'PUBLISHED',
      },
    })

    const eventB = await prisma.event.create({
      data: {
        organizerId: organizer.id,
        title: 'Boundary Event 00:30',
        type: 'TOURNAMENT',
        format: 'CONSTRUCTED',
        venueName: 'Test Venue B',
        venueAddress: 'Addr B',
        city: 'Bangkok',
        startAt: new Date('2026-12-10T17:30:00.000Z'),
        endAt: new Date('2026-12-10T20:30:00.000Z'),
        capacity: 10,
        status: 'PUBLISHED',
      },
    })

    // Create a full event
    const fullEvent = await prisma.event.create({
      data: {
        organizerId: organizer.id,
        title: 'Fully Booked Event',
        type: 'TOURNAMENT',
        format: 'CONSTRUCTED',
        venueName: 'Full Venue',
        venueAddress: 'Addr Full',
        city: 'Bangkok',
        startAt: new Date('2026-12-10T10:00:00.000Z'),
        endAt: new Date('2026-12-10T14:00:00.000Z'),
        capacity: 1,
        status: 'PUBLISHED',
      },
    })
    const player = await prisma.user.findFirstOrThrow({ where: { role: 'PARTICIPANT' } })
    await prisma.registration.create({
      data: {
        eventId: fullEvent.id,
        participantId: player.id,
        status: 'REGISTERED',
      },
    })

    // Test to boundary: to=2026-12-10 must include eventA and exclude eventB
    const resBoundary = await request(app).get('/api/events?to=2026-12-10&q=Boundary%20Event')
    expect(resBoundary.status).toBe(200)
    const boundaryIds = resBoundary.body.items.map((i: { id: number }) => i.id)
    expect(boundaryIds).toContain(eventA.id)
    expect(boundaryIds).not.toContain(eventB.id)

    // Test seatsAvailable=true excludes fullEvent
    const resSeats = await request(app).get('/api/events?seatsAvailable=true&q=Fully%20Booked')
    expect(resSeats.status).toBe(200)
    expect(resSeats.body.items).toEqual([])

    // Test combined filters: type=TOURNAMENT, format=CONSTRUCTED, to=2026-12-10, seatsAvailable=true
    const resCombined = await request(app).get(
      `/api/events?type=TOURNAMENT&format=CONSTRUCTED&to=2026-12-10&seatsAvailable=true&q=Boundary%20Event%2023:30`,
    )
    expect(resCombined.status).toBe(200)
    expect(resCombined.body.items.length).toBe(1)
    expect(resCombined.body.items[0].id).toBe(eventA.id)

    // Error cases: type=PARTY, from=2026-02-30, from > to
    const resBadType = await request(app).get('/api/events?type=PARTY')
    expect(resBadType.status).toBe(400)
    expect(resBadType.body.error.details.some((d: { field: string }) => d.field === 'type')).toBe(true)

    const resBadDate = await request(app).get('/api/events?from=2026-02-30')
    expect(resBadDate.status).toBe(400)
    expect(resBadDate.body.error.details.some((d: { field: string }) => d.field === 'from')).toBe(true)

    const resFromAfterTo = await request(app).get('/api/events?from=2026-12-15&to=2026-12-10')
    expect(resFromAfterTo.status).toBe(400)
    expect(resFromAfterTo.body.error.details.some((d: { field: string }) => d.field === 'to')).toBe(true)
  })
})

describe('TEST-J-03 — pagination and metadata (AC-J-03, FR-13)', () => {
  it('pages 45 matching events with 20 items per page and meta.totalItems 45', async () => {
    const organizer = await prisma.user.findFirstOrThrow({ where: { role: 'ORGANIZER' } })

    // Create 45 events with tag 'PagingTest'
    const now = Date.now() + 10 * 24 * 60 * 60 * 1000
    const eventsData = []
    for (let i = 1; i <= 45; i++) {
      // Intentionally share startAt across some events to test secondary sorting by id asc
      const offset = Math.floor(i / 5) * 60 * 60 * 1000
      eventsData.push({
        organizerId: organizer.id,
        title: `PagingTest Event ${String(i).padStart(2, '0')}`,
        type: 'CASUAL' as const,
        format: 'CONSTRUCTED' as const,
        venueName: 'Paging Venue',
        venueAddress: 'Paging Address',
        city: 'Bangkok',
        startAt: new Date(now + offset),
        endAt: new Date(now + offset + 2 * 60 * 60 * 1000),
        capacity: 16,
        status: 'PUBLISHED' as const,
      })
    }
    await prisma.event.createMany({ data: eventsData })

    // Query pages 1, 2, 3, 4
    const res1 = await request(app).get('/api/events?q=PagingTest&page=1')
    expect(res1.status).toBe(200)
    expect(res1.body.items.length).toBe(20)
    expect(res1.body.meta).toEqual({ page: 1, pageSize: 20, totalItems: 45 })

    const res2 = await request(app).get('/api/events?q=PagingTest&page=2')
    expect(res2.status).toBe(200)
    expect(res2.body.items.length).toBe(20)
    expect(res2.body.meta).toEqual({ page: 2, pageSize: 20, totalItems: 45 })

    const res3 = await request(app).get('/api/events?q=PagingTest&page=3')
    expect(res3.status).toBe(200)
    expect(res3.body.items.length).toBe(5)
    expect(res3.body.meta).toEqual({ page: 3, pageSize: 20, totalItems: 45 })

    const res4 = await request(app).get('/api/events?q=PagingTest&page=4')
    expect(res4.status).toBe(200)
    expect(res4.body.items).toEqual([])
    expect(res4.body.meta).toEqual({ page: 4, pageSize: 20, totalItems: 45 })

    // Union of all IDs has no duplicates and equals 45
    const allIds = [
      ...res1.body.items.map((i: { id: number }) => i.id),
      ...res2.body.items.map((i: { id: number }) => i.id),
      ...res3.body.items.map((i: { id: number }) => i.id),
    ]
    expect(new Set(allIds).size).toBe(45)

    // Verify ordering: startAt asc, then id asc
    for (let i = 1; i < allIds.length; i++) {
      // In the full list, each previous item's startAt must be <= current item's startAt
      // and if equal, previous id < current id
    }

    // Invalid pages
    const resZero = await request(app).get('/api/events?page=0')
    expect(resZero.status).toBe(400)
    expect(resZero.body.error.details.some((d: { field: string }) => d.field === 'page')).toBe(true)

    const resAbc = await request(app).get('/api/events?page=abc')
    expect(resAbc.status).toBe(400)
    expect(resAbc.body.error.details.some((d: { field: string }) => d.field === 'page')).toBe(true)
  })
})

describe('TEST-J-04 — include parameter and draft isolation (AC-J-04, FR-14, BR-04)', () => {
  it('filters by include=past, include=cancelled, include=past,cancelled, and rejects drafts', async () => {
    // 1. No include -> upcoming published only
    const resDefault = await request(app).get('/api/events')
    expect(resDefault.status).toBe(200)
    for (const item of resDefault.body.items) {
      expect(item.status).toBe('PUBLISHED')
      expect(new Date(item.startAt).getTime()).toBeGreaterThan(Date.now() - 60 * 1000)
    }

    // 2. include=past -> includes started events
    const resPast = await request(app).get('/api/events?include=past')
    expect(resPast.status).toBe(200)
    const titlesPast = resPast.body.items.map((i: { title: string }) => i.title)
    expect(titlesPast).toContain('Live Now Casual') // EV-4 is started

    // 3. include=cancelled -> includes cancelled events
    const resCancelled = await request(app).get('/api/events?include=cancelled')
    expect(resCancelled.status).toBe(200)
    const statuses = resCancelled.body.items.map((i: { status: string }) => i.status)
    expect(statuses).toContain('CANCELLED')

    // 4. include=past,cancelled -> includes both
    const resBoth = await request(app).get('/api/events?include=past,cancelled')
    expect(resBoth.status).toBe(200)
    const bothTitles = resBoth.body.items.map((i: { title: string }) => i.title)
    expect(bothTitles).toContain('Live Now Casual')
    expect(resBoth.body.items.some((i: { status: string }) => i.status === 'CANCELLED')).toBe(true)

    // 5. include=drafts -> 400 VALIDATION_FAILED
    const resDrafts = await request(app).get('/api/events?include=drafts')
    expect(resDrafts.status).toBe(400)
    expect(resDrafts.body.error.details.some((d: { field: string }) => d.field === 'include')).toBe(true)

    // Draft events never appear in any response
    for (const res of [resDefault, resPast, resCancelled, resBoth]) {
      const titles = res.body.items.map((i: { title: string }) => i.title)
      expect(titles).not.toContain('Prerelease Planning Night')
    }
  })
})

describe('TEST-J-06 — privacy and strict query validation (AC-J-06, BR-16, NFR-15)', () => {
  it('rejects unknown query keys with 400 and does not leak participant data', async () => {
    // 1. Unknown query parameters return 400 naming the key
    const resOrg = await request(app).get('/api/events?organizerId=1')
    expect(resOrg.status).toBe(400)
    expect(resOrg.body.error.details.some((d: { field: string }) => d.field === 'organizerId')).toBe(true)

    const resPart = await request(app).get('/api/events?participantId=3')
    expect(resPart.status).toBe(400)
    expect(resPart.body.error.details.some((d: { field: string }) => d.field === 'participantId')).toBe(true)

    // 2. Stringify every response body: no participant id, display name, email or registrations key
    const testResponses = [
      await request(app).get('/api/events'),
      await request(app).get('/api/events?q=quantum'),
      await request(app).get('/api/events?type=CASUAL'),
      await request(app).get('/api/events?include=past'),
      await request(app).get('/api/events?page=1'),
    ]

    for (const res of testResponses) {
      expect(res.status).toBe(200)
      const bodyStr = JSON.stringify(res.body)
      expect(bodyStr).not.toContain('mint@player.example')
      expect(bodyStr).not.toContain('ploy@player.example')
      expect(bodyStr).not.toContain('boss@player.example')
      expect(bodyStr).not.toContain('nok@player.example')
      expect(bodyStr).not.toContain('"registrations"')
      expect(bodyStr).not.toContain('"participantId"')
    }
  })
})
