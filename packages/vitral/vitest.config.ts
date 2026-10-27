import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte({ include: ['test/**/*.svelte'] })],
  resolve: {
    conditions: ['browser'],
    // `vitral/next-host` importa do app (Next e o módulo do withVitral).
    alias: { 'next/router': new URL('./test/stubs/next-router.ts', import.meta.url).pathname, 'vitral-next-host-config': new URL('./test/stubs/next-host-config.ts', import.meta.url).pathname },
  },
  test: {
    // Força o build de navegador do Solid/Svelte (o padrão do Node é o de SSR).
    server: { deps: { inline: [/solid-js/, /svelte/] } },
    include: ['test/**/*.test.{ts,tsx}'],
    // Testes de tipos da API pública (expectTypeOf), checados pelo tsc.
    typecheck: { enabled: true, include: ['test/**/*.test-d.ts'], tsconfig: './tsconfig.tipos.json' },
    // Testes não acessam a rede: o CSS dos remotes é simulado.
    environmentOptions: { happyDOM: { settings: { disableCSSFileLoading: true } } },
    coverage: {
      provider: 'v8',
      include: ['src/core/**'],
      reporter: ['text-summary', 'text', 'json-summary'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
})
