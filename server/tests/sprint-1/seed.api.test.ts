import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seed } from '../../prisma/seed.js'
import { verifyPassword } from '../../src/domain/password.js'
import { prisma, resetDb } from '../helpers/db.js'

// TEST-SR1-02 · AC-SR1-02 · NFR-06 (STS §2.1). Expected data: Sprint 1 contracts §0.3.
const PASSWORD = 'local-test-only-seed-password'

const USERS = [
  ['quantum@organizer.example', 'Quantum Cards', 'ORGANIZER'],
  ['dragon@organizer.example', "Dragon's Den", 'ORGANIZER'],
  ['mint@player.example', 'Mint', 'PARTICIPANT'],
  ['ploy@player.example', 'Ploy', 'PARTICIPANT'],
  ['boss@player.example', 'Boss', 'PARTICIPANT'],
  ['nok@player.example', 'Nok', 'PARTICIPANT'],
] as const

// seedKey → [owner email, capacity, registered participants]
const EVENTS: Record<string, [string, number, string[]]> = {
  'EV-1': ['quantum@organizer.example', 24, ['Mint', 'Ploy', 'Boss']],
  'EV-2': ['quantum@organizer.example', 4, ['Mint', 'Ploy', 'Boss']],
  'EV-3': ['dragon@organizer.example', 2, ['Ploy', 'Boss']],
  'EV-4': ['dragon@organizer.example', 8, ['Mint']],
  'EV-5': ['dragon@organizer.example', 16, []],
  'EV-6': ['quantum@organizer.example', 32, []],
}

const counts = async () => ({
  users: await prisma.user.count(),
  events: await prisma.event.count(),
  registrations: await prisma.registration.count(),
})

describe('TEST-SR1-02 the seed creates the contract data once and only once', () => {
  beforeAll(resetDb)
  afterAll(() => prisma.$disconnect())

  it('creates 2 organizers, 4 participants and the 6 events of contracts §0.3', async () => {
    await seed(prisma, PASSWORD)

    const users = await prisma.user.findMany({ orderBy: { id: 'asc' } })
    expect(users.map((u) => [u.email, u.displayName, u.role])).toEqual(USERS)

    for (const [key, [owner, capacity, names]] of Object.entries(EVENTS)) {
      const event = await prisma.event.findUniqueOrThrow({
        where: { seedKey: key },
        include: { organizer: true, registrations: { include: { participant: true } } },
      })
      expect(event.organizer.email, key).toBe(owner)
      expect(event.capacity, key).toBe(capacity)
      expect(event.status, key).toBe('PUBLISHED')
      expect(event.registrations.map((r) => r.participant.displayName).sort(), key).toEqual([...names].sort())
      expect(event.registrations.every((r) => r.status === 'REGISTERED'), key).toBe(true)
    }
    expect(await counts()).toEqual({ users: 6, events: 6, registrations: 9 })
  })

  it('gives EV-3 no free seat, EV-2 exactly one, and EV-4 a start in the past and an end in the future', async () => {
    const now = Date.now()
    const ev2 = await prisma.event.findUniqueOrThrow({ where: { seedKey: 'EV-2' }, include: { registrations: true } })
    const ev3 = await prisma.event.findUniqueOrThrow({ where: { seedKey: 'EV-3' }, include: { registrations: true } })
    const ev4 = await prisma.event.findUniqueOrThrow({ where: { seedKey: 'EV-4' } })
    expect(ev2.capacity - ev2.registrations.length).toBe(1)
    expect(ev3.capacity - ev3.registrations.length).toBe(0)
    expect(ev4.startAt.getTime()).toBeLessThan(now)
    expect(ev4.endAt.getTime()).toBeGreaterThan(now)
    const upcoming = await prisma.event.count({ where: { seedKey: { not: 'EV-4' }, startAt: { gt: new Date(now) } } })
    expect(upcoming).toBe(5)
  })

  it('stores scrypt hashes that verify with the seed password', async () => {
    const mint = await prisma.user.findUniqueOrThrow({ where: { email: 'mint@player.example' } })
    expect(mint.passwordHash).toMatch(/^scrypt\$32768\$8\$1\$/)
    expect(await verifyPassword(PASSWORD, mint.passwordHash)).toBe(true)
    expect(await verifyPassword('wrong-password', mint.passwordHash)).toBe(false)
  })

  it('adds nothing when it runs a second time', async () => {
    const before = await counts()
    await seed(prisma, PASSWORD)
    expect(await counts()).toEqual(before)
  })

  it('refuses to run without a password of at least 12 characters', async () => {
    await expect(seed(prisma, '')).rejects.toThrow(/SEED_PASSWORD/)
    await expect(seed(prisma, 'short')).rejects.toThrow(/at least 12/)
  })
})
