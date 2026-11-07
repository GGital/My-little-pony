// Run with DATABASE_URL set to the TEST database (e2e-api.mjs, and before each Playwright file): empty every table,
// load the §0.3 seed, then add Fern, the "second participant created for the test" of JRN-02 (STS §2.12). Fern
// exists only in the E2E database, never in the demo seed. Ids restart at 1, so EV-1 … EV-6 are ids 1 … 6.
import { PrismaClient } from '@prisma/client'
import { seed } from '../prisma/seed.js'
import { hashPassword } from '../src/domain/password.js'

const test = process.env.DATABASE_URL_TEST
if (!test || process.env.DATABASE_URL !== test) {
  throw new Error('e2e-seed.ts runs only with DATABASE_URL set to DATABASE_URL_TEST')
}

const prisma = new PrismaClient()
try {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Registration", "Session", "Event", "User" RESTART IDENTITY CASCADE')
  await seed(prisma)
  await prisma.user.create({
    data: {
      email: 'fern@player.example',
      displayName: 'Fern',
      role: 'PARTICIPANT',
      passwordHash: await hashPassword(process.env.SEED_PASSWORD!),
    },
  })
} finally {
  await prisma.$disconnect()
}
