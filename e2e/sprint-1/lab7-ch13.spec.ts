import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { EMAIL, bangkokLocal, resetSeed, signIn } from './helpers'

// Lab 7 change CH-13 (Issue #77): BR-02 start must be at least 60 minutes after creation (AC-D-03 v2).
// The same file runs on the pre-change code (L7_SIDE=before: the red run, left column of the PDF) and on the changed
// code (L7_SIDE=after: the green run, right column). Every step saves a screenshot and a JSON record (Lab 7 §4.2:
// evidence ID, action, expected, actual, time, tested commit) under docs/labs/lab07/evidence/.
const SIDE = process.env.L7_SIDE === 'before' ? 'before' : 'after'
// Files are written only when L7_SIDE is set, so a plain E2E run leaves the Lab 7 evidence alone (AGENTS.md §5).
const WRITE = process.env.L7_SIDE !== undefined
const DIR = 'docs/labs/lab07/evidence'
const MSG = 'The start must be at least 60 minutes from now.'

function commit(): string {
  const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  const dirty = execSync('git status --porcelain -- server client e2e', { encoding: 'utf8' }).trim() !== ''
  return dirty ? `${sha} + uncommitted changes` : sha
}

/** Screenshot + record for one evidence step. `actual` is read from the page, never typed in. */
async function evidence(page: Page, id: string, action: string, expected: string, focus?: Locator) {
  if (!WRITE) return
  mkdirSync(DIR, { recursive: true })
  const file = `${id}-${SIDE}.png`
  if (focus) await focus.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${DIR}/${file}` })
  const alert = await page.locator('[role="alert"]').allInnerTexts()
  const heading = await page.locator('h1').first().innerText().catch(() => '')
  const record = {
    id, side: SIDE, action, expected,
    actual: { url: new URL(page.url()).pathname, heading, messages: alert.map((t) => t.trim()).filter(Boolean) },
    time: new Date().toISOString(), commit: commit(), screenshot: file,
  }
  writeFileSync(`${DIR}/${id}-${SIDE}.json`, JSON.stringify(record, null, 2) + '\n')
}

/** `datetime-local` value (Bangkok wall time) `minutes` from now, truncated to the minute like the form input. */
function bangkokIn(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000 + 7 * 3_600_000).toISOString().slice(0, 16)
}

async function fillEvent(page: Page, title: string, startAt: string, endAt: string) {
  await page.goto('/organizer/events/new')
  await page.locator('#title').fill(title)
  await page.getByText('CASUAL', { exact: true }).click()
  await page.getByText('CONSTRUCTED', { exact: true }).click()
  await page.locator('#venueName').fill('Quantum Cards')
  await page.locator('#venueAddress').fill('1631 Kanchanaphisek Rd')
  await page.locator('#city').fill('Bangkok')
  await page.locator('#startAt').fill(startAt)
  await page.locator('#endAt').fill(endAt)
  await page.locator('#capacity').fill('16')
}

test.use({ viewport: { width: 1280, height: 900 } })
test.beforeAll(resetSeed)

/** Waits until the publish has settled either way: the server's field error, or the new event's detail page. */
async function settled(page: Page) {
  const outcome = page.locator('[data-testid^="field-error-"]').or(page.getByText('Your event is live.'))
  await expect(outcome.first()).toBeVisible()
  return outcome.first()
}

test.describe('changed behaviour (CH-13)', () => {
  test.beforeEach(async ({ page }) => signIn(page, EMAIL.quantum))

  test('TEST-L7-01 (E2E) — a start 30 minutes away is rejected on the start field, nothing published (AC-D-03 v2)', async ({ page }) => {
    await fillEvent(page, 'Lunch Break Casual', bangkokIn(30), bangkokIn(150))
    await evidence(page, 'L7-B01-form', 'Quantum Cards fills the create form with a start 30 minutes from now', 'Start field shows the hint "(at least 1 hour from now)"', page.locator('#startAt'))
    await page.getByLabel(/^Game/).selectOption('POKEMON')
    await page.getByRole('button', { name: 'PUBLISH EVENT' }).click()
    const b01 = await settled(page)
    await evidence(page, 'L7-B01-result', 'Press PUBLISH EVENT', `Stays on the form; the start field says "${MSG}"; no event is published`, b01)

    await expect(page).toHaveURL('/organizer/events/new')
    await expect(page.locator('#startAt')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByTestId('field-error-startAt')).toHaveText(MSG)
    await expect(page.getByText('(at least 1 hour from now)')).toBeVisible()
    await page.goto('/organizer')
    await expect(page.getByText('Lunch Break Casual')).toHaveCount(0)
  })

  test('TEST-L7-02 (E2E) — a start 62 minutes away is accepted: "Your event is live." (AC-D-03 v2 boundary side)', async ({ page }) => {
    await fillEvent(page, 'Evening Casual', bangkokIn(62), bangkokIn(182))
    await page.getByLabel(/^Game/).selectOption('POKEMON')
    await page.getByRole('button', { name: 'PUBLISH EVENT' }).click()
    const b02 = await settled(page)
    await evidence(page, 'L7-B02-result', 'Publish an event starting 62 minutes from now', 'Event detail page with "Your event is live."', b02)

    await expect(page).toHaveURL(/\/events\/\d+$/)
    await expect(page.getByText('Your event is live.')).toBeVisible()
  })
})

test.describe('preserved Sprint 1 behaviour', () => {
  test('TEST-L7-03 (E2E) — an event longer than 24 hours is still rejected on the end field (BR-02 end rule)', async ({ page }) => {
    await signIn(page, EMAIL.quantum)
    await fillEvent(page, 'Marathon Weekend', bangkokLocal(5, 10), bangkokLocal(6, 11))
    await page.getByLabel(/^Game/).selectOption('POKEMON')
    await page.getByRole('button', { name: 'PUBLISH EVENT' }).click()
    const p01 = await settled(page)
    await evidence(page, 'L7-P01-result', 'Publish an event 5 days ahead that lasts 25 hours', 'Stays on the form; the end field says "An event can last at most 24 hours."', p01)

    await expect(page).toHaveURL('/organizer/events/new')
    await expect(page.locator('#endAt')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByTestId('field-error-endAt')).toHaveText('An event can last at most 24 hours.')
  })

  test('TEST-L7-04 (E2E) — a participant still cannot open the create page (BR-13 access)', async ({ page }) => {
    await signIn(page, EMAIL.mint)
    await page.goto('/organizer/events/new')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await evidence(page, 'L7-P02-result', 'Mint (participant) opens /organizer/events/new', 'The "This page isn\'t available for your account" page; no form')

    await expect(page.getByTestId('not-available-page')).toBeVisible()
    await expect(page.locator('#startAt')).toHaveCount(0)
  })
})
