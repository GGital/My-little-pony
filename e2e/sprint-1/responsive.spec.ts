import { expect, test, type Page } from '@playwright/test'
import { EMAIL, EV, resetSeed, signIn } from './helpers'

// SR-05 (contracts §13, AC-SR5-01): the 7 Sprint 1 screens at 390, 768 and 1440 px never scroll sideways.
// Screenshots for the PDF go to docs/sprints/sprint-1/evidence/responsive/.
const WIDTHS = [390, 768, 1440] as const
const SHOTS = 'docs/sprints/sprint-1/evidence/responsive'

type Screen = { name: string; path: string; as?: string; ready: (p: Page) => Promise<void> }
const heading = (name: string) => async (p: Page) => {
  await expect(p.getByRole('heading', { name, exact: true }).first()).toBeVisible()
}
const SCREENS: Screen[] = [
  { name: 'events', path: '/events', ready: heading('Find an Event') },
  { name: 'event-detail', path: `/events/${EV[1]}`, ready: heading('Friday Night Constructed') },
  { name: 'login', path: '/login', ready: heading('Sign in') },
  { name: 'my-events', path: '/me/registrations', as: EMAIL.mint, ready: heading('My Events') },
  { name: 'dashboard', path: '/organizer', as: EMAIL.quantum, ready: heading('Dashboard') },
  { name: 'create-event', path: '/organizer/events/new', as: EMAIL.quantum, ready: heading('Create an event') },
  { name: 'registrations', path: `/organizer/events/${EV[1]}/registrations`, as: EMAIL.quantum, ready: heading('Friday Night Constructed') },
]

test.beforeAll(resetSeed)

for (const screen of SCREENS) {
  test.describe(`TEST-SR5-01 — ${screen.path} (AC-SR5-01, NFR-08)`, () => {
    test.beforeEach(async ({ page }) => {
      if (screen.as) await signIn(page, screen.as)
    })

    for (const width of WIDTHS) {
      test(`${width} px: no horizontal scroll`, async ({ page }) => {
        await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })
        await page.goto(screen.path)
        await screen.ready(page)
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }))
        await page.screenshot({ path: `${SHOTS}/${width}-${screen.name}.png`, fullPage: true })
        expect(scrollWidth, `${screen.path} at ${width} px`).toBeLessThanOrEqual(innerWidth)
      })
    }
  })
}
