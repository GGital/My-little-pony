import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { EMAIL, resetSeed, signIn } from '../sprint-1/helpers'

// S2-01 (Issue #78) before / after evidence for the PR. The same file runs on the pre-change code (S2_SIDE=before,
// at the red commit) and on the changed code (S2_SIDE=after, at the green commit). Every step saves a screenshot
// and a JSON record (ID, action, expected, actual read from the page or the response, time, tested commit) under
// docs/sprints/sprint-2/evidence/. The assertions hold on both sides; the difference is in the records.
const SIDE = process.env.S2_SIDE === 'before' ? 'before' : 'after'
// Files are written only when S2_SIDE is set, so a plain E2E run leaves the evidence alone (AGENTS.md §5).
const WRITE = process.env.S2_SIDE !== undefined
const DIR = 'docs/sprints/sprint-2/evidence'

function commit(): string {
  const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  const dirty = execSync('git status --porcelain -- server client e2e', { encoding: 'utf8' }).trim() !== ''
  return dirty ? `${sha} + uncommitted changes` : sha
}

function record(id: string, action: string, expected: string, actual: unknown, screenshot?: string) {
  if (!WRITE) return
  mkdirSync(DIR, { recursive: true })
  const body = { id, side: SIDE, action, expected, actual, time: new Date().toISOString(), commit: commit(), screenshot }
  writeFileSync(`${DIR}/${id}-${SIDE}.json`, JSON.stringify(body, null, 2) + '\n')
}

/** Full-page screenshot plus the card titles shown, read from the page. */
async function listStep(page: Page, id: string, action: string, expected: string) {
  const cards = page.locator('.event-card .event-card__title')
  await expect(cards.first()).toBeVisible()
  const file = `${id}-${SIDE}.png`
  if (WRITE) await page.screenshot({ path: `${DIR}/${file}`, fullPage: true })
  record(id, action, expected, { url: new URL(page.url()).pathname, titles: await cards.allInnerTexts() }, file)
}

test.use({ viewport: { width: 1280, height: 900 } })
test.beforeAll(resetSeed)

test('S2-01-U1 /events as a visitor: the published seed events (EV-9 added, EV-7 draft and EV-8 cancelled hidden)', async ({ page }) => {
  await page.goto('/events')
  await listStep(page, 'S2-01-U1-events', 'Visitor opens /events', 'After: 6 cards, "Early Deadline Sealed" (EV-9) second; no draft, no cancelled event')
})

test('S2-01-U2 /organizer as Quantum Cards: the draft EV-7 and EV-9 are listed', async ({ page }) => {
  await signIn(page, EMAIL.quantum)
  await page.goto('/organizer')
  await listStep(page, 'S2-01-U2-organizer', 'Quantum Cards opens /organizer', 'After: 5 events, with "Early Deadline Sealed" and the draft "Prerelease Planning Night"')
})

test('S2-01-U3 /me/registrations as Mint: the EV-9 registration is listed', async ({ page }) => {
  await signIn(page, EMAIL.mint)
  await page.goto('/me/registrations')
  await listStep(page, 'S2-01-U3-my-events', 'Mint opens /me/registrations', 'After: 4 cards, "Early Deadline Sealed" third')
})

test('S2-01-A1 E-17 change history of EV-1 for the owner, another organizer, a participant and a visitor', async ({ page, browser }) => {
  const call = async (p: Page) => {
    const res = await p.request.get('/api/organizer/events/1/changes')
    return { status: res.status(), body: await res.json().catch(() => null) }
  }
  const visitor = await call(page)
  await signIn(page, EMAIL.quantum)
  const owner = await call(page)
  const other = await browser.newPage()
  await signIn(other, EMAIL.dragon)
  const otherOrganizer = await call(other)
  const participant = await browser.newPage()
  await signIn(participant, EMAIL.mint)
  const mint = await call(participant)
  expect(visitor.status).toBeGreaterThanOrEqual(400)
  record('S2-01-A1-e17', 'GET /api/organizer/events/1/changes as Quantum Cards (owner), Dragon\'s Den, Mint and a visitor',
    'After: 200 { items: [] } for the owner (the seed writes no history rows), 404 EVENT_NOT_FOUND, 403 FORBIDDEN, 401 UNAUTHENTICATED',
    { owner, otherOrganizer, participant: mint, visitor })
})

test('S2-01-A2 creating an event through E-06 writes its first history row, read back with E-17', async ({ page, baseURL }) => {
  await signIn(page, EMAIL.quantum)
  const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  const created = await page.request.post('/api/events', {
    headers: { Origin: baseURL! },
    data: {
      title: 'S2-01 Evidence Night', type: 'CASUAL', format: 'CONSTRUCTED', venueName: 'Quantum Cards',
      venueAddress: '1631 Kanchanaphisek Rd', city: 'Bangkok', capacity: 24,
      startAt: start.toISOString(), endAt: new Date(start.getTime() + 4 * 60 * 60 * 1000).toISOString(),
    },
  })
  expect(created.status()).toBe(201)
  const { id } = await created.json()
  const history = await page.request.get(`/api/organizer/events/${id}/changes`)
  record('S2-01-A2-create-history', `POST /api/events as Quantum Cards (capacity 24), then GET /api/organizer/events/${id}/changes`,
    'After: 201, then 200 with one item: status null → PUBLISHED, changedBy "Quantum Cards", no email or user id',
    { create: { status: created.status(), id }, history: { status: history.status(), body: await history.json().catch(() => null) } })
})
