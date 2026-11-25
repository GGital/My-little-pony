import { z } from 'zod'

/** The one message for every bad cancel reason (Sprint 2 contracts §6). */
export const REASON_MESSAGE = 'Give a reason of 5 to 200 characters.'

// STUB (S2-05 commit A): accepts any string, so TEST-O-03 fails on its assertions until commit B.
export const cancelBody = z.object({ reason: z.string() }).strict()
