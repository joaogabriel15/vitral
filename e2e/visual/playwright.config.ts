// Regressão visual: screenshots da demo comparados com os da base do PR.
//
// Sem imagens versionadas: a fonte e o antialiasing mudam entre máquinas, então
// a linha de base é gerada na mesma máquina, a partir do build da base:
//
//   VISUAL_ROOT=../base pnpm --dir e2e exec playwright test -c visual --update-snapshots
//   pnpm --dir e2e exec playwright test -c visual
//
// VISUAL_ROOT é a raiz do repositório cujo build da demo é servido (padrão: este).
import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(process.env.VISUAL_ROOT ?? fileURLToPath(new URL('../..', import.meta.url)))

export default defineConfig({
  testDir: '.',
  testMatch: '*.visual.ts',
  timeout: 30_000,
  reporter: [['list']],
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002 } },
  use: { trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [{ command: `node ${root}/demo/serve.mjs`, url: 'http://localhost:5173', reuseExistingServer: false }],
})
