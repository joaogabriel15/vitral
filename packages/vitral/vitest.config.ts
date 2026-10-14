import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte({ include: ['test/**/*.svelte'] })],
  resolve: { conditions: ['browser'] },
  test: {
    // Força o build de navegador do Solid/Svelte (o padrão do Node é o de SSR).
    server: { deps: { inline: [/solid-js/, /svelte/] } },
    include: ['test/**/*.test.{ts,tsx}'],
    // Testes não acessam a rede: o CSS dos remotes é simulado.
    environmentOptions: { happyDOM: { settings: { disableCSSFileLoading: true } } },
    coverage: {
      provider: 'v8',
      include: ['src/core/**'],
      reporter: ['text-summary', 'text'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
})
