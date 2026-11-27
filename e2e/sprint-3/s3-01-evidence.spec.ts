import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { EMAIL, EV, resetSeed, signIn } from '../sprint-1/helpers'

// S3-01 (Issue #96) before / after evidence for the PR. Runs on the code before S3-01 (S3_SIDE=before, S3_CODE names
// it) and on the green commit (S3_SIDE=after). Files are written only when S3_SIDE is set (AGENTS.md §5), each with a
// JSON record: ID, action, expected, actual (read from the page and the API), time, tested commit.
const SIDE = process.env.S3_SIDE === 'before' ? 'before' : 'after'
const WRITE = process.env.S3_SIDE !== undefined
const DIR = 'docs/sprints/sprint-3/evidence'
const ORIGIN = 'http://localhost:5174'

function commit(): string {
  if (process.env.S3_CODE) return process.env.S3_CODE
  const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  const dirty = execSync('git status --porcelain -- server client e2e', { encoding: 'utf8' }).trim() !== ''
  return dirty ? `${sha} + uncommitted changes` : sha
}
function record(id: string, action: string, expected: string, actual: unknown, screenshot: string) {
  if (!WRITE) return
  mkdirSync(DIR, { recursive: true })
  const body = { id, side: SIDE, action, expected, actual, time: new Date().toISOString(), commit: commit(), screenshot }
  writeFileSync(`${DIR}/${id}-${SIDE}.json`, JSON.stringify(body, null, 2) + '\n')
}
async function shot(page: Page, id: string) {
  const file = `${id}-${SIDE}.png`
  if (WRITE) await page.screenshot({ path: `${DIR}/${file}`, fullPage: true })
  return file
}
/** Mint's registration on EV-4, read from E-08 as its owner. */
async function mintRegistration(page: Page) {
  const list = await (await page.request.get(`/api/organizer/events/${EV[4]}/registrations`)).json()
  return list.items.find((r: { participant: { displayName: string } }) => r.participant.displayName === 'Mint') as { id: number }
}

test.use({ viewport: { width: 1280, height: 900 } })
test.beforeEach(resetSeed)

test('S3-01-P1 the owner checks Mint in at the door on EV-4 (AC-P-01, FR-21, FR-28)', async ({ page }) => {
  await signIn(page, EMAIL.dragon)
  await page.goto(`/organizer/events/${EV[4]}/registrations`)
  await expect(page.getByRole('heading', { name: 'Live Now Casual' })).toBeVisible()
  const mint = await mintRegistration(page)
  const button = page.getByRole('button', { name: 'Check in Mint' })
  if (await button.count()) {
    await button.click()
    await expect(page.getByText('Checked in 1 / 1')).toBeVisible()
  }
  const list = await (await page.request.get(`/api/organizer/events/${EV[4]}/registrations`)).json()
  const file = await shot(page, 'S3-01-P1')
  record(
    'S3-01-P1',
    "Dragon's Den opens /organizer/events/EV-4/registrations and presses CHECK IN on Mint's row",
    'Door check-in: Mint\'s row reads "Checked in HH:MM" with Undo; "Checked in 1 / 1"; E-08 row CHECKED_IN by Dragon\'s Den; counts { active 1, checkedIn 1 }',
    {
      checkInButtons: await page.getByRole('button', { name: /^Check in / }).count(),
      undoButtons: await page.getByRole('button', { name: /^Undo check-in/ }).count(),
      countLine: (await page.getByText(/^Checked in \d+ \/ \d+$/).count()) ? await page.getByText(/^Checked in \d+ \/ \d+$/).innerText() : null,
      e08Row: list.items.find((r: { id: number }) => r.id === mint.id),
      e08CheckIn: list.checkIn ?? null,
      e08Counts: list.counts ?? null,
    },
    file,
  )
})

test('S3-01-P5 another organizer and a participant try E-18 on Mint\'s EV-4 registration (AC-P-05, BR-14)', async ({ page, browser }) => {
  await signIn(page, EMAIL.dragon)
  const mint = await mintRegistration(page)

  const other = await browser.newPage()
  await signIn(other, EMAIL.quantum)
  const call = async (p: Page, id: number | string) => {
    const res = await p.request.post(`/api/organizer/registrations/${id}/check-in`, { headers: { Origin: ORIGIN }, data: {} })
    return { status: res.status(), body: await res.text() }
  }
  const byOther = await call(other, mint.id)
  const missing = await call(other, 999999)
  await other.goto(`/organizer/events/${EV[4]}/registrations`)
  const file = await shot(other, 'S3-01-P5')
  await other.close()

  const player = await browser.newPage()
  await signIn(player, EMAIL.mint)
  const byPlayer = await call(player, mint.id)
  await player.close()

  const after = await (await page.request.get(`/api/organizer/events/${EV[4]}/registrations`)).json()
  record(
    'S3-01-P5',
    "Quantum Cards (not the owner) and Mint call E-18 on Mint's EV-4 registration; Quantum Cards opens EV-4's Door check-in",
    'Quantum Cards: 404 REGISTRATION_NOT_FOUND, byte-identical to id 999999; Mint: 403 FORBIDDEN; the row stays REGISTERED; the page is the not-found page',
    {
      anotherOrganizer: byOther,
      missingId: missing,
      identicalTo999999: byOther.body === missing.body,
      participant: byPlayer,
      mintStatusAfter: after.items.find((r: { id: number }) => r.id === mint.id)?.status,
    },
    file,
  )
})
