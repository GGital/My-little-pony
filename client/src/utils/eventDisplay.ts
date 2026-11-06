/** Display helpers shared by every event card and the detail page (design-direction §5). All times are Bangkok. */

const LABELS: Record<string, string> = {
  CASUAL: 'Casual',
  TOURNAMENT: 'Tournament',
  RELEASE: 'Release',
  CONSTRUCTED: 'Constructed',
  SEALED: 'Sealed',
  DRAFT: 'Draft',
}

/** "CASUAL" → "Casual". Unknown values are shown as they come. */
export const label = (value: string): string => LABELS[value] ?? value

export type SeatLevel = 'ok' | 'low' | 'full'

/** Teal, amber when ≤ 20 % of capacity is left (rounded down, minimum 1), red at 0 (contracts §9 Behaviour 3). */
export function seatLevel(e: { seatsRemaining: number; capacity: number }): SeatLevel {
  if (e.seatsRemaining <= 0) return 'full'
  return e.seatsRemaining <= Math.max(1, Math.floor(e.capacity * 0.2)) ? 'low' : 'ok'
}

export const seatsLeft = (n: number): string => `${n} seat${n === 1 ? '' : 's'} left`

const part = (iso: string, opts: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', ...opts }).format(new Date(iso))

/** The date badge on a card: { month: "NOV", day: "7" }. */
export function dateBadge(iso: string): { month: string; day: string } {
  return { month: part(iso, { month: 'short' }).toUpperCase(), day: part(iso, { day: 'numeric' }) }
}

/** "Sat 7 Nov 2026" */
export const formatDate = (iso: string): string =>
  part(iso, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(',', '')

/** "17:00–21:00" */
export const formatTimeRange = (startIso: string, endIso: string): string => {
  const t = (iso: string) => part(iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return `${t(startIso)}–${t(endIso)}`
}
