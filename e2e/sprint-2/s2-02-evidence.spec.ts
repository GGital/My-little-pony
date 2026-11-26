import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { EMAIL, bangkokLocal, resetSeed, signIn } from '../sprint-1/helpers'

// S2-02 (Issue #79) before / after evidence for the PR. The same file runs on the pre-change code (S2_SIDE=before,
// at the red commit) and on the changed code (S2_SIDE=after, at the green commit). Every step saves a screenshot
// and/or a JSON record (ID, action, expected, actual read from the page or the response, time, tested commit) under
// docs/sprints/sprint-2/evidence/. The assertions hold on both sides; the difference is in the records.
const SIDE = process.env.S2_SIDE === 'before' ? 'before' : 'after'
// Files are written only when S2_SIDE is set, so a plain E2E run leaves the evidence alone (AGENTS.md §5).
const WRITE = process.env.S2_SIDE !== undefined
const DIR = 'docs/sprints/sprint-2/evidence'
const EV7 = 7 // the seeded draft "Prerelease Planning Night" (Sprint 2 contracts §0.4; e2e-seed restarts ids)

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

async function shot(page: Page, id: string) {
  const file = `${id}-${SIDE}.png`
  if (!WRITE) return file
  await page.screenshot({ path: `${DIR}/${file}`, fullPage: true })
  return file
}

const buttons = async (page: Page) =>
  (await page.locator('.form-actions button, .event-card__actions button, .event-card__actions a').allInnerTexts()).map((t) => t.trim())
const notices = async (page: Page) => (await page.locator('.notice').allInnerTexts()).map((t) => t.trim())

test.use({ viewport: { width: 1280, height: 900 } })
test.beforeAll(resetSeed)

test('S2-02-U1 the create form: SAVE DRAFT next to PUBLISH EVENT', async ({ page }) => {
  await signIn(page, EMAIL.quantum)
  await page.goto('/organizer/events/new')
  await expect(page.getByRole('button', { name: 'PUBLISH EVENT' })).toBeVisible()
  const actions = page.locator('.form-actions')
  await actions.scrollIntoViewIfNeeded()
  const file = await shot(page, 'S2-02-U1-create-form')
  record('S2-02-U1-create-form', 'Quantum Cards opens /organizer/events/new', 'After: PUBLISH EVENT and SAVE DRAFT', { buttons: await buttons(page) }, file)
})

test('S2-02-U2 saving a draft from the form lands on the draft with the owner-only banner', async ({ page }) => {
  await signIn(page, EMAIL.quantum)
  await page.goto('/organizer/events/new')
  await page.locator('#title').fill('S2-02 Evidence Draft')
  await page.getByText('CASUAL', { exact: true }).click()
  await page.getByText('CONSTRUCTED', { exact: true }).click()
  await page.locator('#venueName').fill('Quantum Cards')
  await page.locator('#venueAddress').fill('1631 Kanchanaphisek Rd')
  await page.locator('#city').fill('Bangkok')
  await page.locator('#startAt').fill(bangkokLocal(4, 18))
  await page.locator('#endAt').fill(bangkokLocal(4, 22))
  await page.locator('#capacity').fill('16')
  const saveDraft = page.getByRole('button', { name: 'SAVE DRAFT' })
  const hasButton = (await saveDraft.count()) > 0
  if (hasButton) {
    await saveDraft.click()
    // Since S2-04 a new draft lands on its edit page (contracts v0.8), so wait for the toast both pages show.
    await expect(page.getByText('Draft saved. Only you can see it.')).toBeVisible()
  }
  const file = await shot(page, 'S2-02-U2-save-draft')
  record('S2-02-U2-save-draft', 'Quantum Cards fills the form and presses SAVE DRAFT',
    'After: lands on /events/:id with "Draft saved. Only you can see it." and the banner "Draft — only you can see this event."',
    { saveDraftButton: hasButton, url: new URL(page.url()).pathname, notices: await notices(page) }, file)
})

test('S2-02-U3 the dashboard publishes EV-7, which then appears on /events', async ({ page }) => {
  await signIn(page, EMAIL.quantum)
  await page.goto('/organizer')
  const card = page.locator('.event-card', { hasText: 'Prerelease Planning Night' })
  await expect(card).toBeVisible()
  await card.scrollIntoViewIfNeeded()
  const before = await shot(page, 'S2-02-U3-dashboard')
  const actions = (await card.locator('.event-card__actions a, .event-card__actions button').allInnerTexts()).map((t) => t.trim())
  const publish = card.getByRole('button', { name: 'Publish Prerelease Planning Night' })
  let afterClick: { notices: string[]; chip: string } | null = null
  if ((await publish.count()) > 0) {
    await publish.click()
    await expect(page.getByText('Your event is live.')).toBeVisible()
    afterClick = { notices: await notices(page), chip: (await card.locator('.chip--muted').innerText()).trim() }
    await shot(page, 'S2-02-U3-dashboard-published')
  }
  await page.goto('/events')
  await expect(page.locator('.event-card__title').first()).toBeVisible()
  const titles = await page.locator('.event-card__title').allInnerTexts()
  const list = await shot(page, 'S2-02-U3-events')
  record('S2-02-U3-dashboard', 'Quantum Cards opens /organizer, presses Publish on EV-7, then opens /events',
    'After: EV-7 row shows Draft, Publish and View (no Registrations); "Your event is live."; EV-7 listed on /events',
    { ev7Actions: actions, afterPublish: afterClick, eventsListsEv7: titles.includes('Prerelease Planning Night') }, `${before}, ${list}`)
})

test('S2-02-A1 the API on the seeded draft EV-7: E-05 for the owner and a visitor, E-09 by Nok, E-14 for each role', async ({ page, browser, baseURL }) => {
  resetSeed()
  const call = async (p: Page, method: 'GET' | 'POST', path: string) => {
    const res = method === 'GET' ? await p.request.get(path) : await p.request.post(path, { headers: { Origin: baseURL! }, data: {} })
    const body = await res.json().catch(() => null)
    return { status: res.status(), code: body?.error?.code ?? null, status_: body?.status ?? null, action: body?.viewer?.action ?? null }
  }
  const visitorE05 = await call(page, 'GET', `/api/events/${EV7}`)
  const visitorE14 = await call(page, 'POST', `/api/organizer/events/${EV7}/publish`)

  const nok = await browser.newPage()
  await signIn(nok, EMAIL.nok)
  const nokE09 = await call(nok, 'POST', `/api/events/${EV7}/registrations`)
  const nokE14 = await call(nok, 'POST', `/api/organizer/events/${EV7}/publish`)

  const dragon = await browser.newPage()
  await signIn(dragon, EMAIL.dragon)
  const dragonE05 = await call(dragon, 'GET', `/api/events/${EV7}`)
  const dragonE14 = await call(dragon, 'POST', `/api/organizer/events/${EV7}/publish`)

  await signIn(page, EMAIL.quantum)
  const ownerE05 = await call(page, 'GET', `/api/events/${EV7}`)
  const ownerE14 = await call(page, 'POST', `/api/organizer/events/${EV7}/publish`)
  const ownerE14Again = await call(page, 'POST', `/api/organizer/events/${EV7}/publish`)
  expect(visitorE05.status).toBe(404)
  record('S2-02-A1-api', 'E-05, E-09 and E-14 on the seeded draft EV-7 as each role (fresh seed)',
    'After: E-05 owner 200 DRAFT MANAGE, visitor and Dragon 404 EVENT_NOT_FOUND; E-09 Nok 404 EVENT_NOT_FOUND; E-14 visitor 401, Nok 403, Dragon 404, owner 200 PUBLISHED, again 409 ALREADY_PUBLISHED',
    { e05: { owner: ownerE05, visitor: visitorE05, dragon: dragonE05 }, e09: { nok: nokE09 },
      e14: { visitor: visitorE14, nok: nokE14, dragon: dragonE14, owner: ownerE14, ownerAgain: ownerE14Again } })
})
