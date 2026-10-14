import { defineConfig } from '@playwright/test'

// Rode uma vez: npx playwright install chromium
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:__PORT__' },
  webServer: { command: 'npm run dev', url: 'http://localhost:__PORT__', reuseExistingServer: true },
})
