import { expect, test, type Page } from '@playwright/test'
import { EMAIL, EV, resetSeed, signIn } from '../sprint-1/helpers'

// TEST-SR5-05 (STS §2.10, NFR-08): the 3 new Sprint 2 screens at 390, 768 and 1440 px never scroll sideways.
// TEST-SR5-01 (e2e/sprint-1/responsive.spec.ts) still checks the 7 Sprint 1 screens. Screenshots for the PDF go to
// docs/sprints/sprint-2/evidence/responsive/, only when EVIDENCE=1 (AGENTS.md §5).
const WIDTHS = [390, 768, 1440] as const
const SHOTS = 'docs/sprints/sprint-2/evidence/responsive'
const WRITE = process.env.EVIDENCE === '1'

type Screen = { name: string; path: string; as?: string; ready: (p: Page) => Promise<void> }
const SCREENS: Screen[] = [
  {
    name: 'edit-event',
    path: `/organizer/events/${EV[1]}/edit`,
    as: EMAIL.quantum,
    ready: async (p) => {
      await expect(p.getByRole('heading', { name: 'Edit event', exact: true })).toBeVisible()
      await expect(p.getByRole('region', { name: 'History' })).toBeVisible()
    },
  },
  {
    name: 'search-filters',
    path: '/events?q=quantum&format=CONSTRUCTED&game=MAGIC&include=past,cancelled',
    ready: async (p) => {
      await expect(p.getByRole('button', { name: 'Clear all' })).toBeVisible()
      await expect(p.locator('a.event-card').first()).toBeVisible()
    },
  },
  {
    name: 'cancelled-detail',
    path: '/events/8', // EV-8 "Rainy Day Casual", cancelled in the seed
    as: 'boss@player.example',
    ready: async (p) => {
      await expect(p.getByText('Cancelled by the organizer: Store closed for flooding repairs.')).toBeVisible()
    },
  },
]

test.beforeAll(resetSeed)

for (const screen of SCREENS) {
  test.describe(`TEST-SR5-05 — ${screen.name} (NFR-08)`, () => {
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
        if (WRITE) await page.screenshot({ path: `${SHOTS}/${width}-${screen.name}.png`, fullPage: true })
        expect(scrollWidth, `${screen.path} at ${width} px`).toBeLessThanOrEqual(innerWidth)
      })
    }
  })
}
