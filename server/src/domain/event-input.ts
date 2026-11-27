import { z } from 'zod'

/** The one message for every bad cancel reason (Sprint 2 contracts §6). */
export const REASON_MESSAGE = 'Give a reason of 5 to 200 characters.'

export const REASON_MIN = 5
export const REASON_MAX = 200

/** E-15 body: the reason is trimmed, then must be 5–200 characters; any other field is refused (BR-12, BR-17). */
export const cancelBody = z
  .object({
    reason: z.string({ error: REASON_MESSAGE }).trim().min(REASON_MIN, REASON_MESSAGE).max(REASON_MAX, REASON_MESSAGE),
  })
  .strict()
