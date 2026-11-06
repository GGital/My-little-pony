import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// End-to-end suite (STS §1.2): Chromium against a real API and the Vite client, both started here. The API runs on
// the TEST database with a fresh §0.3 seed (server/scripts/e2e-api.mjs), so the development data is never touched.
// server/.env gives the runner SEED_PASSWORD for signing in as the demo accounts; it is never printed or committed.
if (existsSync('server/.env')) process.loadEnvFile('server/.env')

const API_PORT = 3100
const APP_PORT = 5174
const APP = `http://localhost:${APP_PORT}`

export default defineConfig({
  testDir: 'e2e/sprint-1',
  // The journeys change the shared seed (a seat taken, an event published), so the files run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: APP,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm --prefix server run e2e:api',
      url: `http://localhost:${API_PORT}/api/health`,
      env: { E2E_API_PORT: String(API_PORT), E2E_APP_ORIGIN: APP },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npm --prefix client run dev -- --port ${APP_PORT} --strictPort`,
      url: APP,
      env: { API_TARGET: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
