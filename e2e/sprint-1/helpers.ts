import { spawnSync } from 'node:child_process'
import { expect, type Page } from '@playwright/test'

// Shared steps for the Sprint 1 Playwright files (STS §1.2, §1.3). The seed (contracts §0.3) gives these ids,
// because e2e-seed.ts empties the tables and restarts the ids before loading it.
export const EV = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 } as const

export const EMAIL = {
  quantum: 'quantum@organizer.example',
  dragon: 'dragon@organizer.example',
  mint: 'mint@player.example',
  nok: 'nok@player.example',
  fern: 'fern@player.example', // E2E only (JRN-02)
} as const

/** Puts the test database back to the fresh seed. Each file calls it first, so no file depends on another. */
export function resetSeed() {
  const result = spawnSync('npx', ['tsx', 'scripts/e2e-seed.ts'], {
    cwd: 'server',
    shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST },
    encoding: 'utf8',
  })
  if (result.status !== 0) throw new Error(`e2e-seed.ts failed:\n${result.stderr}`)
}

/** The demo password from server/.env (playwright.config.ts loads it). Never logged. */
function seedPassword(): string {
  const password = process.env.SEED_PASSWORD
  if (!password) throw new Error('SEED_PASSWORD is not set in server/.env')
  return password
}

/** Fills and sends the sign-in form on the page that is already open (`/login…`). */
export async function submitSignIn(page: Page, email: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(seedPassword())
  await page.getByRole('button', { name: 'SIGN IN' }).click()
}

/** Opens `/login`, signs in through the real E-01, and waits until the header shows the account. */
export async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await submitSignIn(page, email)
  await expect(page.getByTestId('user-menu-btn')).toBeVisible()
}

/** Signs out from the header menu (E-02) and waits for the signed-out header. */
export async function signOut(page: Page) {
  await page.getByTestId('user-menu-btn').click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
}

/** `datetime-local` value (Bangkok wall time, which the form sends with +07:00) `days` from now at `hour`:00. */
export function bangkokLocal(days: number, hour: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000)
  const date = d.toISOString().slice(0, 10)
  return `${date}T${String(hour).padStart(2, '0')}:00`
}
