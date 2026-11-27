import type { PrismaClient } from '@prisma/client'
import type { Actor } from './actor.js'
import type { GameValue, StoreProfileData } from './store-contact.js'

export type StoreContact = { phone: string | null; email: string | null; website: string | null; line: string | null }
export type StoreProfile = { displayName: string; games: GameValue[]; contact: StoreContact }

/** Only these columns are ever read: the sign-in email (D-14) is never selected. */
export const storeSelect = {
  displayName: true,
  games: true,
  contactPhone: true,
  contactEmail: true,
  contactWebsite: true,
  contactLine: true,
} as const

type StoreRow = {
  displayName: string
  games: GameValue[]
  contactPhone: string | null
  contactEmail: string | null
  contactWebsite: string | null
  contactLine: string | null
}

export const toContact = (u: StoreRow): StoreContact => ({
  phone: u.contactPhone,
  email: u.contactEmail,
  website: u.contactWebsite,
  line: u.contactLine,
})

const toProfile = (u: StoreRow): StoreProfile => ({ displayName: u.displayName, games: u.games, contact: toContact(u) })

/** E-23 GET: the caller's own store. */
export async function getStoreProfile(db: PrismaClient, actor: Actor): Promise<StoreProfile> {
  return toProfile(await db.user.findUniqueOrThrow({ where: { id: actor.id }, select: storeSelect }))
}

/** E-23 PATCH: changes only the caller's own row, and only the fields sent. */
export async function updateStoreProfile(db: PrismaClient, actor: Actor, data: StoreProfileData): Promise<StoreProfile> {
  return toProfile(await db.user.update({ where: { id: actor.id }, data, select: storeSelect }))
}
