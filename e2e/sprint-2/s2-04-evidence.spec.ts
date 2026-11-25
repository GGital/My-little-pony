import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { EMAIL, resetSeed, signIn } from '../sprint-1/helpers'

// S2-04 (Issue #81) before / after evidence for the PR. The same file runs on the pre-change code (S2_SIDE=before,
// at the red commit) and on the changed code (S2_SIDE=after, at the green commit). Every step saves a screenshot
// and/or a JSON record (ID, action, expected, actual read from the page or the response, time, tested commit) under
// docs/sprints/sprint-2/evidence/. The assertions hold on both sides; the difference is in the records.
const SIDE = process.env.S2_SIDE === 'before' ? 'before' : 'after'
const DIR = 'docs/sprints/sprint-2/evidence'
const EV1 = 1 // "Friday Night Constructed", Quantum Cards, 3 players (e2e-seed restarts ids)
const EV4 = 4 // "Live Now Casual", Dragon's Den, started 1 h before the seed

function commit(): string {
  const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  const dirty = execSync('git status --porcelain -- server client e2e', { encoding: 'utf8' }).trim() !== ''
  return dirty ? `${sha} + uncommitted changes` : sha
}

function record(id: string, action: string, expected: string, actual: unknown, screenshot?: string) {
  mkdirSync(DIR, { recursive: true })
  const body = { id, side: SIDE, action, expected, actual, time: new Date().toISOString(), commit: commit(), screenshot }
  writeFileSync(`${DIR}/${id}-${SIDE}.json`, JSON.stringify(body, null, 2) + '\n')
}

async function shot(page: Page, id: string) {
  const file = `${id}-${SIDE}.png`
  await page.screenshot({ path: `${DIR}/${file}`, fullPage: true })
  return file
}

const text = async (page: Page, selector: string) => (await page.locator(selector).allInnerTexts()).map((t) => t.trim()).filter(Boolean)

test.use({ viewport: { width: 1280, height: 900 } })
test.beforeEach(resetSeed)

test('S2-04-U1 Quantum Cards opens the edit page of EV-1 from the event page', async ({ page }) => {
  await signIn(page, EMAIL.quantum)
  await page.goto(`/events/${EV1}`)
  const manage = page.getByRole('link', { name: 'MANAGE EVENT' })
  const href = await manage.getAttribute('href')
  await page.goto(`/organizer/events/${EV1}/edit`)
  await expect(page.locator('h1').first()).toBeVisible()
  const file = await shot(page, 'S2-04-U1-edit-page')
  record('S2-04-U1-edit-page', 'Quantum Cards: MANAGE EVENT on /events/1, then /organizer/events/1/edit',
    'After: MANAGE EVENT opens /organizer/events/1/edit; the form holds EV-1, the capacity hint says "At least 3", the History panel lists the creation',
    { manageHref: href, heading: await page.locator('h1').first().innerText(), hint: await text(page, '.field-hint, .capacity-hint'),
      history: await text(page, 'section[aria-label="History"] li') }, file)
})

test('S2-04-U2 the dashboard rows offer Edit', async ({ page }) => {
  await signIn(page, EMAIL.quantum)
  await page.goto('/organizer')
  await expect(page.locator('.event-card').first()).toBeVisible()
  const file = await shot(page, 'S2-04-U2-dashboard')
  record('S2-04-U2-dashboard', 'Quantum Cards opens /organizer', 'After: every row has Edit (the draft EV-7 has Publish, Edit and View)',
    { actions: await page.locator('.event-card').evaluateAll((cards) =>
      cards.map((c) => [c.querySelector('.event-card__title')?.textContent, [...c.querySelectorAll('.event-card__actions a, .event-card__actions button')].map((a) => a.textContent?.trim())])) }, file)
})

test('S2-04-U3 saving a title change, then a capacity below the registrations', async ({ page }) => {
  await signIn(page, EMAIL.quantum)
  await page.goto(`/organizer/events/${EV1}/edit`)
  const save = page.getByRole('button', { name: 'SAVE CHANGES' })
  const hasForm = (await save.count()) > 0
  let saved: unknown = null
  let refused: unknown = null
  if (hasForm) {
    await page.locator('#title').fill('Friday Night Modern')
    await save.click()
    await expect(page.getByText('Changes saved.')).toBeVisible()
    saved = { notices: await text(page, '.notice'), history: await text(page, 'section[aria-label="History"] li') }
    await shot(page, 'S2-04-U3-saved')
    await page.locator('#capacity').fill('2')
    await save.click()
    await expect(page.getByRole('alert')).toBeVisible()
    refused = { alert: await page.getByRole('alert').innerText(), capacityInput: await page.locator('#capacity').inputValue() }
  }
  const file = await shot(page, 'S2-04-U3-capacity-refused')
  record('S2-04-U3-save', 'Quantum Cards edits EV-1: title "Friday Night Modern" → SAVE CHANGES; then capacity 2 → SAVE CHANGES',
    'After: "Changes saved." and a History line "changed title"; then the alert "3 players are registered, so capacity can\'t go below 3." with 2 kept in the field',
    { hasForm, saved, refused }, file)
})

test("S2-04-U4 Dragon's Den opens the edit page of its started event EV-4", async ({ page }) => {
  await signIn(page, EMAIL.dragon)
  await page.goto(`/organizer/events/${EV4}/edit`)
  await expect(page.locator('h1').first()).toBeVisible()
  const file = await shot(page, 'S2-04-U4-started')
  const readOnly = await page.locator('input[readonly]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).id))
  record('S2-04-U4-started', "Dragon's Den opens /organizer/events/4/edit (EV-4 started 1 h before the seed)",
    'After: the note "This event has started. Only the description, structure, contact and fee can change." and the frozen fields read-only',
    { notes: await text(page, '.notice'), readOnly }, file)
})

test('S2-04-A1 E-13 on EV-1 for each role, a capacity below the registrations, and the history it leaves', async ({ page, browser, baseURL }) => {
  const patch = async (p: Page, id: number | string, data: object) => {
    const res = await p.request.patch(`/api/organizer/events/${id}`, { headers: { Origin: baseURL! }, data })
    const body = await res.json().catch(() => null)
    return { status: res.status(), code: body?.error?.code ?? null, details: body?.error?.details ?? null, title: body?.title ?? null, capacity: body?.capacity ?? null }
  }
  const visitor = await patch(page, EV1, { description: 'Edited.' })
  const mint = await browser.newPage()
  await signIn(mint, EMAIL.mint)
  const dragon = await browser.newPage()
  await signIn(dragon, EMAIL.dragon)
  const participant = await patch(mint, EV1, { description: 'Edited.' })
  const otherOrganizer = await patch(dragon, EV1, { description: 'Edited.' })
  await signIn(page, EMAIL.quantum)
  const empty = await patch(page, EV1, {})
  const belowRegistered = await patch(page, EV1, { capacity: 2 })
  const capacity = await patch(page, EV1, { capacity: 30 })
  const history = await page.request.get(`/api/organizer/events/${EV1}/changes`)
  const items = ((await history.json().catch(() => null))?.items ?? []) as { field: string; oldValue: string | null; newValue: string }[]
  expect(visitor.status).toBeGreaterThanOrEqual(400)
  record('S2-04-A1-api', 'PATCH /api/organizer/events/1 as a visitor, Mint, Dragon\'s Den, then Quantum Cards with {}, capacity 2 and capacity 30; GET its changes',
    'After: 401, 403, 404 EVENT_NOT_FOUND; 400 "Change at least one field."; 409 CAPACITY_BELOW_REGISTERED; 200 capacity 30; history capacity 24 → 30',
    { visitor, participant, otherOrganizer, empty, belowRegistered, capacity, history: { status: history.status(), items: items.map((c) => [c.field, c.oldValue, c.newValue]) } })
})
