import { defineConfig, devices } from '@playwright/test'

// Navegadores: E2E_BROWSERS=chromium,firefox,webkit,mobile (padrão: só chromium).
// "mobile" é o Chromium com a tela e o toque de um celular (Pixel 7).
// No CI cada navegador roda em jobs próprios, divididos em shards.
const browsers = (process.env.E2E_BROWSERS ?? 'chromium').split(',').map((b) => b.trim())
const DEVICES = { chromium: 'Desktop Chrome', firefox: 'Desktop Firefox', webkit: 'Desktop Safari', mobile: 'Pixel 7' } as const

// Rode antes: pnpm build:all (na raiz). Os servidores abaixo só servem o que já foi buildado.
export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  // Remotes da bateria de versões cruzadas, buildados com cada versão da lib.
  globalSetup: './versoes/build.mjs',
  use: { trace: 'retain-on-failure' },
  projects: browsers.map((name) => ({ name, use: { ...devices[DEVICES[name as keyof typeof DEVICES]] } })),
  webServer: [
    { command: 'node ../examples/serve.mjs', url: 'http://localhost:4100/react/vitral.json', reuseExistingServer: true },
    { command: 'pnpm --dir ../examples/hosts/next start', url: 'http://localhost:4208', reuseExistingServer: true, env: { NEXT_TELEMETRY_DISABLED: '1' } },
    { command: 'pnpm --dir ../examples/hosts/nuxt start', url: 'http://localhost:4209', reuseExistingServer: true },
    { command: 'node ../demo/serve.mjs', url: 'http://localhost:5173', reuseExistingServer: true },
    // Host e CDN de teste das baterias de rede, deploy, versões e segurança.
    { command: 'node fixtures/server.mjs', url: 'http://localhost:4400/vitral/index.js', reuseExistingServer: true },
  ],
})
