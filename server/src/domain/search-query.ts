import { z } from 'zod'

/**
 * Validates that a string is a real calendar date in YYYY-MM-DD format.
 */
function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const [year = 0, month = 0, day = 0] = dateStr.split('-').map(Number)
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000

/**
 * Returns UTC [start, end) Date objects representing the full Bangkok calendar day (00:00:00 to 24:00:00 +07:00).
 * Bangkok is UTC+7 (D-22).
 */
export function bangkokDayRange(dateStr: string): [Date, Date] {
  if (!isValidDateString(dateStr)) {
    throw new Error(`Invalid calendar date: ${dateStr}`)
  }
  const [year = 0, month = 0, day = 0] = dateStr.split('-').map(Number)
  const utcMidnight = Date.UTC(year, month - 1, day)
  const bangkokStartUTC = new Date(utcMidnight - BANGKOK_OFFSET_MS)
  const bangkokEndUTC = new Date(bangkokStartUTC.getTime() + 24 * 60 * 60 * 1000)
  return [bangkokStartUTC, bangkokEndUTC]
}

/**
 * Escapes PostgreSQL LIKE/ILIKE wildcards (% and _) so they match literally.
 */
export function escapeLikeWildcards(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&')
}

export const searchQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      .max(100, 'Search text cannot exceed 100 characters.')
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    type: z.enum(['CASUAL', 'TOURNAMENT', 'RELEASE']).optional(),
    format: z.enum(['CONSTRUCTED', 'SEALED', 'DRAFT']).optional(),
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.')
      .refine(isValidDateString, 'Invalid calendar date.')
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.')
      .refine(isValidDateString, 'Invalid calendar date.')
      .optional(),
    seatsAvailable: z.enum(['true', 'false']).optional(),
    include: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val) return true
          const parts = val.split(',').map((p) => p.trim())
          return parts.length > 0 && parts.every((p) => p === 'past' || p === 'cancelled')
        },
        { message: 'include must be a comma-separated list of past, cancelled.' },
      ),
    page: z
      .string()
      .regex(/^[1-9]\d*$/, 'Page must be a positive integer.')
      .optional()
      .default('1')
      .transform((v) => parseInt(v, 10)),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.from && data.to && data.from > data.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'The end date must be on or after the start date.',
        path: ['to'],
      })
    }
  })

export type SearchQuery = z.infer<typeof searchQuerySchema>
