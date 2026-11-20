import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte({ include: ['test/**/*.svelte'] })],
  resolve: {
    conditions: ['browser'],
    // `vitral/next-host` importa do app (Next e o módulo do withVitral).
    alias: { 'next/head': new URL('./test/stubs/next-head.ts', import.meta.url).pathname, 'next/router': new URL('./test/stubs/next-router.ts', import.meta.url).pathname, 'vitral-next-host-config': new URL('./test/stubs/next-host-config.ts', import.meta.url).pathname },
  },
  test: {
    // Força o build de navegador do Solid/Svelte (o padrão do Node é o de SSR).
    server: { deps: { inline: [/solid-js/, /svelte/] } },
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/setup-lang.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Testes de tipos da API pública (expectTypeOf), checados pelo tsc.
    typecheck: { enabled: true, include: ['test/**/*.test-d.ts'], tsconfig: './tsconfig.tipos.json' },
    // Testes não acessam a rede: o CSS dos remotes é simulado.
    environmentOptions: { happyDOM: { settings: { disableCSSFileLoading: true } } },
    coverage: {
      provider: 'v8',
      // Todo o código da lib conta. O núcleo (o que vai para o navegador de todo host) tem o próprio limite.
      include: ['src/**'],
      // `cli.ts` só despacha para `src/cli/*`, que os testes chamam direto.
      exclude: ['src/cli.ts'],
      reporter: ['text-summary', 'text', 'json-summary'],
      // O total fica no nível de hoje, para não cair; suba quando a cobertura subir.
      thresholds: {
        lines: 95,
        functions: 92,
        branches: 85,
        statements: 93,
        'src/core/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },
})
