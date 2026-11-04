import { PrismaClient } from '@prisma/client'

// I-01 commit A: placeholder only. The real seed (Sprint 1 contracts §0.3) is implemented in commit B,
// after TEST-SR1-02 has been run and seen to fail.
export const SEED_PASSWORD_MIN_LENGTH = 12

export async function seed(_prisma: PrismaClient, password = process.env.SEED_PASSWORD): Promise<void> {
  if (!password || password.length < SEED_PASSWORD_MIN_LENGTH) {
    throw new Error(`SEED_PASSWORD must be set and at least ${SEED_PASSWORD_MIN_LENGTH} characters`)
  }
}
