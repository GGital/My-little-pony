import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { EMAIL, resetSeed, signIn } from '../sprint-1/helpers'

// S2-08 (Issue #87) before / after evidence for the PR, for the two fixes. Runs on the red commit (S2_SIDE=before) and
// the fix commit (S2_SIDE=after). Files are written only when S2_SIDE is set (AGENTS.md §5), each with a JSON record:
// ID, action, expected, actual (read from the page), time, tested commit.
const SIDE = process.env.S2_SIDE === 'before' ? 'before' : 'after'
const WRITE = process.env.S2_SIDE !== undefined
const DIR = 'docs/sprints/sprint-2/evidence'

function commit(): string {
  // The "before" side runs the red commit's client files in this checkout; S2_CODE names them.
  if (process.env.S2_CODE) return process.env.S2_CODE
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

test.use({ viewport: { width: 1280, height: 900 } })
test.beforeEach(resetSeed)

test('S2-08-U1 a visitor lists past and cancelled events', async ({ page }) => {
  await page.goto('/events?include=past,cancelled')
  const ended = page.locator('a.event-card--ended')
  await expect(ended.first()).toBeVisible()
  const axe = await new AxeBuilder({ page }).include('a.event-card--ended').withRules(['color-contrast']).analyze()
  const file = await shot(page, 'S2-08-U1-ended-cards')
  record('S2-08-U1-ended-cards', 'A visitor opens /events?include=past,cancelled (EV-4 started, EV-8 cancelled)',
    'After: the Past and Cancelled cards are dimmed by a grey surface, and axe finds 0 colour-contrast failures on them',
    {
      cards: await ended.locator('.event-card__title').allInnerTexts(),
      look: await ended.first().evaluate((el) => { const s = getComputedStyle(el); return { opacity: s.opacity, background: s.backgroundColor } }),
      contrastFailures: axe.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(' ')}: ${n.any[0]?.data?.contrastRatio ?? '?'}:1`)),
    }, file)
})

test('S2-08-A1 the cascade order on the store profile page', async ({ page }) => {
  await signIn(page, EMAIL.quantum)
  await page.goto('/organizer/store')
  await expect(page.locator('.store-profile__chip').first()).toBeVisible()
  const order = await page.evaluate(() => {
    const selectors: string[] = []
    for (const sheet of [...document.styleSheets]) for (const rule of [...sheet.cssRules]) if (rule instanceof CSSStyleRule) selectors.push(rule.selectorText)
    return { themeChipRule: selectors.indexOf('.chip'), featureChipRule: selectors.indexOf('.store-profile__chip') }
  })
  const file = await shot(page, 'S2-08-A1-store-chips')
  record('S2-08-A1-store-chips', 'Quantum Cards opens /organizer/store; read the position of the theme .chip rule and the feature .store-profile__chip rule',
    'After: the feature rule comes after the theme rule; the toggles look the same as before', order, file)
})
