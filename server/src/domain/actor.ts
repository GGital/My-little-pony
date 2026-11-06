import type { Role } from '@prisma/client'

/**
 * The signed-in caller (contracts §5 Behaviour 1). Set by loadSession from the session only; domain services
 * receive it as their first argument, never `req` (SD-10).
 */
export type Actor = { id: number; role: Role; displayName: string }

// I-06 red stub: the owner is not yet part of the where clause.
export const ownedEventWhere = (_actor: Actor, id: number) => ({ id })
export const ownRegistrationWhere = (_actor: Actor, id: number) => ({ id })
