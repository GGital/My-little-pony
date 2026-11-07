import type { Role } from '@prisma/client'

/**
 * The signed-in caller (contracts §5 Behaviour 1). Set by loadSession from the session only; domain services
 * receive it as their first argument, never `req` (SD-10).
 */
export type Actor = { id: number; role: Role; displayName: string }

/**
 * The owner always goes into the where clause (contracts §5 Behaviour 3), so another user's record and a missing
 * one give the same "not found", and the caller cannot tell whether it exists (D-08, BR-13, BR-14).
 */
export const ownedEventWhere = (actor: Actor, id: number) => ({ id, organizerId: actor.id })
export const ownRegistrationWhere = (actor: Actor, id: number) => ({ id, participantId: actor.id })
