// Store profile rules (Feature-U, Sprint 2 contracts §11.1, D-37): pure, no database.
export const GAMES = ['POKEMON', 'MAGIC', 'ONE_PIECE', 'YUGIOH', 'DIGIMON', 'LORCANA', 'OTHER'] as const
export type GameValue = (typeof GAMES)[number]

export type StoreProfileError = { field: string; message: string }
export type StoreProfileData = {
  games?: GameValue[]
  contactPhone?: string | null
  contactEmail?: string | null
  contactWebsite?: string | null
  contactLine?: string | null
}
export type StoreProfileResult = { ok: true; data: StoreProfileData } | { ok: false; errors: StoreProfileError[] }

const MESSAGES = {
  contactPhone: 'Enter a phone number, for example 02 555 0101.',
  contactEmail: 'Enter an email address, for example hello@store.example.',
  contactWebsite: 'Enter a web address starting with https://.',
  contactLine: 'Enter a LINE ID, for example @quantumcards.',
  games: 'Choose each game at most once, from the list.',
} as const

const isPhone = (v: string) => /^[0-9 +\-()]{9,20}$/.test(v) && v.replace(/\D/g, '').length >= 9
const isEmail = (v: string) => v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const isLine = (v: string) => /^@?[A-Za-z0-9._-]{1,39}$/.test(v)
/** http(s) only, so `javascript:`, `data:` and `ftp:` never reach a link (NFR-15). */
function isWebsite(v: string): boolean {
  if (v.length > 200 || /[\s\u0000-\u001f]/.test(v) || !/^https?:\/\//i.test(v)) return false
  try {
    const url = new URL(v)
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname !== ''
  } catch {
    return false
  }
}

const CONTACT = {
  contactPhone: { valid: isPhone, normalize: (v: string) => v },
  contactEmail: { valid: isEmail, normalize: (v: string) => v.toLowerCase() },
  contactWebsite: { valid: isWebsite, normalize: (v: string) => v },
  contactLine: { valid: isLine, normalize: (v: string) => v },
} as const

/**
 * E-23 body: any of `games` and the four contact fields. Contact values are trimmed; `""` and `null` clear a field;
 * the email is stored lower-case. Every failing field is reported together; `{}` is "Change at least one field.".
 */
export function validateStoreProfile(body: unknown): StoreProfileResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, errors: [{ field: 'body', message: 'Send a JSON object.' }] }
  }
  const input = body as Record<string, unknown>
  const errors: StoreProfileError[] = []
  const data: StoreProfileData = {}

  for (const key of Object.keys(input)) {
    if (key !== 'games' && !Object.hasOwn(CONTACT, key)) errors.push({ field: key, message: 'This value cannot be set.' })
  }

  if (input.games !== undefined) {
    const games = input.games
    const ok =
      Array.isArray(games) &&
      games.length <= 7 &&
      games.every((g) => typeof g === 'string' && (GAMES as readonly string[]).includes(g)) &&
      new Set(games).size === games.length
    if (ok) data.games = games as GameValue[]
    else errors.push({ field: 'games', message: MESSAGES.games })
  }

  for (const field of Object.keys(CONTACT) as (keyof typeof CONTACT)[]) {
    const raw = input[field]
    if (raw === undefined) continue
    if (raw === null) {
      data[field] = null
      continue
    }
    const value = typeof raw === 'string' ? raw.trim() : undefined
    if (value === undefined) errors.push({ field, message: MESSAGES[field] })
    else if (value === '') data[field] = null
    else if (CONTACT[field].valid(value)) data[field] = CONTACT[field].normalize(value)
    else errors.push({ field, message: MESSAGES[field] })
  }

  if (errors.length) return { ok: false, errors }
  if (Object.keys(data).length === 0) return { ok: false, errors: [{ field: 'body', message: 'Change at least one field.' }] }
  return { ok: true, data }
}
