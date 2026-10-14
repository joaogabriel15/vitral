import { defineConfig } from '@playwright/test'

// Rode antes: pnpm build:all (na raiz). Os servidores abaixo só servem o que já foi buildado.
export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
  webServer: [
    { command: 'node ../examples/serve.mjs', url: 'http://localhost:4100/react/vitral.json', reuseExistingServer: true },
    { command: 'pnpm --dir ../examples/hosts/next start', url: 'http://localhost:4208', reuseExistingServer: true, env: { NEXT_TELEMETRY_DISABLED: '1' } },
    { command: 'pnpm --dir ../examples/hosts/nuxt start', url: 'http://localhost:4209', reuseExistingServer: true },
    { command: 'node ../demo/serve.mjs', url: 'http://localhost:5173', reuseExistingServer: true },
  ],
})
