/** The E-04 filters as they appear in the /events URL (Feature-J contracts §7). The URL is the single source of truth. */
export interface SearchFilters {
  q: string
  type: string
  format: string
  game: string
  from: string
  to: string
  seatsAvailable: boolean
  past: boolean
  page: number
}

export const EMPTY_FILTERS: SearchFilters = {
  q: '',
  type: '',
  format: '',
  game: '',
  from: '',
  to: '',
  seatsAvailable: false,
  past: false,
  page: 1,
}

/** `include=past,cancelled` is one switch in the UI ("Show past and cancelled events"). */
export function parseFilters(params: URLSearchParams): SearchFilters {
  const include = (params.get('include') ?? '').split(',')
  const page = Number(params.get('page'))
  return {
    q: params.get('q') ?? '',
    type: params.get('type') ?? '',
    format: params.get('format') ?? '',
    game: params.get('game') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    seatsAvailable: params.get('seatsAvailable') === 'true',
    past: include.includes('past') || include.includes('cancelled'),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  }
}

/** The query string for both the URL and the E-04 request; empty filters are left out. */
export function toQuery(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams()
  const q = filters.q.trim()
  if (q) params.set('q', q)
  if (filters.type) params.set('type', filters.type)
  if (filters.format) params.set('format', filters.format)
  if (filters.game) params.set('game', filters.game)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.seatsAvailable) params.set('seatsAvailable', 'true')
  if (filters.past) params.set('include', 'past,cancelled')
  params.set('page', String(filters.page))
  return params
}

export const PAGE_SIZE = 20

/** "21–40 of 45" for page 2 of 45; the last page ends at the total. */
export function rangeLabel(page: number, totalItems: number): string {
  if (totalItems === 0) return '0 of 0'
  const first = (page - 1) * PAGE_SIZE + 1
  if (first > totalItems) return `0 of ${totalItems}`
  return `${first}–${Math.min(page * PAGE_SIZE, totalItems)} of ${totalItems}`
}
