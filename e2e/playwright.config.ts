import { defineConfig, devices } from '@playwright/test'

// Navegadores: E2E_BROWSERS=chromium,firefox,webkit (padrão: só chromium).
// No CI cada navegador roda em um job próprio.
const browsers = (process.env.E2E_BROWSERS ?? 'chromium').split(',').map((b) => b.trim())
const DEVICES = { chromium: 'Desktop Chrome', firefox: 'Desktop Firefox', webkit: 'Desktop Safari' } as const

// Rode antes: pnpm build:all (na raiz). Os servidores abaixo só servem o que já foi buildado.
export default defineConfig({
  testDir: '.',
  // A CLI tem e2e próprio, com rede: pnpm test:create.
  testIgnore: 'create.spec.ts',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
  projects: browsers.map((name) => ({ name, use: { ...devices[DEVICES[name as keyof typeof DEVICES]] } })),
  webServer: [
    { command: 'node ../examples/serve.mjs', url: 'http://localhost:4100/react/vitral.json', reuseExistingServer: true },
    { command: 'pnpm --dir ../examples/hosts/next start', url: 'http://localhost:4208', reuseExistingServer: true, env: { NEXT_TELEMETRY_DISABLED: '1' } },
    { command: 'pnpm --dir ../examples/hosts/nuxt start', url: 'http://localhost:4209', reuseExistingServer: true },
    { command: 'node ../demo/serve.mjs', url: 'http://localhost:5173', reuseExistingServer: true },
  ],
})
