import { defineConfig, devices } from '@playwright/test'

// Só o e2e da CLI (create.spec.ts). Rode antes: pnpm build (na raiz).
export default defineConfig({
  testDir: '.',
  testMatch: 'create.spec.ts',
  globalSetup: './create.setup.ts',
  workers: 3,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
