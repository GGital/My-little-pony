import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { EMAIL, resetSeed, signIn } from '../sprint-1/helpers'

// S2-06 (Issue #83) before / after evidence for the PR. Runs on the pre-change code (S2_SIDE=before, red commit) and
// the changed code (S2_SIDE=after, green commit). Files are written only when S2_SIDE is set (AGENTS.md §5), each
// with a JSON record: ID, action, expected, actual (read from the page or response), time, tested commit.
const SIDE = process.env.S2_SIDE === 'before' ? 'before' : 'after'
const WRITE = process.env.S2_SIDE !== undefined
const DIR = 'docs/sprints/sprint-2/evidence'
const EV1 = 1 // "Friday Night Constructed", Quantum Cards
const EV9 = 9 // "Early Deadline Sealed": deadline 1 h before the seed, start 2 days after it; Mint registered

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
  if (WRITE) await page.screenshot({ path: `${DIR}/${file}`, fullPage: true })
  return file
}
const texts = async (page: Page, selector: string) => (await page.locator(selector).allInnerTexts()).map((t) => t.trim()).filter(Boolean)

test.use({ viewport: { width: 1280, height: 900 } })
test.beforeEach(resetSeed)

test('S2-06-U1 Nok opens EV-9, whose registration deadline has passed', async ({ page }) => {
  await signIn(page, EMAIL.nok)
  await page.goto(`/events/${EV9}`)
  await expect(page.getByRole('heading', { name: 'Early Deadline Sealed' })).toBeVisible()
  const file = await shot(page, 'S2-06-U1-ev9')
  record('S2-06-U1-ev9', 'Nok opens /events/9 (deadline 1 h before the seed, start 2 days after it)',
    'After: "Registration closes …" under the seats card and a disabled REGISTRATION CLOSED',
    { action: await texts(page, '.dhead__action button, .dhead__action a'), closes: await texts(page, '.deadline-note') }, file)
})

test('S2-06-U2 the create form has a "Registration closes" field', async ({ page }) => {
  await signIn(page, EMAIL.quantum)
  await page.goto('/organizer/events/new')
  await expect(page.getByRole('heading', { name: 'Create an event' })).toBeVisible()
  await page.locator('#startAt').scrollIntoViewIfNeeded()
  const file = await shot(page, 'S2-06-U2-create-form')
  record('S2-06-U2-create-form', 'Quantum Cards opens /organizer/events/new', 'After: "Registration closes (Bangkok)" with the hint "Leave empty to close at the start time."',
    { labels: await texts(page, 'label.form-label') }, file)
})

test('S2-06-U3 Quantum Cards sets a deadline on EV-1 from the edit page', async ({ page }) => {
  await signIn(page, EMAIL.quantum)
  await page.goto(`/organizer/events/${EV1}/edit`)
  await expect(page.locator('h1').first()).toBeVisible()
  const field = page.locator('#registrationDeadline')
  let saved: unknown = null
  if ((await field.count()) > 0) {
    const start = await page.locator('#startAt').inputValue()
    const deadline = new Date(new Date(`${start}:00.000+07:00`).getTime() - 2 * 3_600_000 + 7 * 3_600_000).toISOString().slice(0, 16)
    await field.fill(deadline)
    await page.getByRole('button', { name: 'SAVE CHANGES' }).click()
    await expect(page.getByText('Changes saved.')).toBeVisible()
    saved = { deadline, history: await texts(page, 'section[aria-label="History"] li') }
  }
  const file = await shot(page, 'S2-06-U3-edit-deadline')
  record('S2-06-U3-edit-deadline', 'Quantum Cards: /organizer/events/1/edit, Registration closes = start − 2 h, SAVE CHANGES',
    'After: "Changes saved." and a History line "Quantum Cards changed the registration deadline"', { hasField: (await field.count()) > 0, saved }, file)
})

test('S2-06-A1 the API on EV-9: its effective deadline, and Nok registering after it', async ({ page, baseURL }) => {
  const detail = await (await page.request.get(`/api/events/${EV9}`)).json()
  await signIn(page, EMAIL.nok)
  const res = await page.request.post(`/api/events/${EV9}/registrations`, { headers: { Origin: baseURL! }, data: {} })
  const body = await res.json().catch(() => null)
  expect(detail.id).toBe(EV9)
  record('S2-06-A1-api', 'GET /api/events/9 as a visitor; POST /api/events/9/registrations as Nok',
    'After: registrationDeadline = the stored deadline (1 h before the seed); E-09 409 REGISTRATION_CLOSED',
    { e05: { startAt: detail.startAt, registrationDeadline: detail.registrationDeadline ?? null, action: detail.viewer?.action },
      e09: { status: res.status(), code: body?.error?.code ?? null } })
})
