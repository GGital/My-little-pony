import { z } from 'zod'

/**
 * Minimal stub for search-query domain module to enable test suite compilation.
 */

export function bangkokDayRange(_dateStr: string): [Date, Date] {
  throw new Error('Not implemented')
}

export function escapeLikeWildcards(s: string): string {
  return s
}

export const searchQuerySchema = z.object({}).strict()
export type SearchQuery = z.infer<typeof searchQuerySchema>
