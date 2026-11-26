import { expect, test } from '@playwright/test'
import { EMAIL, resetSeed, signIn } from '../sprint-1/helpers'

// TEST-U-08 (E2E) · UX-17, D-41 review of #113: on /organizer/store a pressed game toggle must look different from an
// unpressed one in the real stylesheet order (component CSS is loaded before theme.css, so a one-class rule loses).
test.beforeAll(() => resetSeed())

test('TEST-U-08 (E2E) — pressed and unpressed game toggles differ in computed style', async ({ page }) => {
  await signIn(page, EMAIL.quantum)
  await page.goto('/organizer/store')
  const chips = page.locator('.store-profile__chip')
  await expect(chips.first()).toBeVisible()
  const on = chips.locator('xpath=self::*[@aria-pressed="true"]').first()
  const off = chips.locator('xpath=self::*[@aria-pressed="false"]').first()
  await expect(on).toBeVisible()
  await expect(off).toBeVisible()
  const look = (l: typeof on) => l.evaluate((el) => { const s = getComputedStyle(el); return [s.backgroundColor, s.borderTopColor, s.color].join('|') })
  expect(await look(on)).not.toBe(await look(off))
})
