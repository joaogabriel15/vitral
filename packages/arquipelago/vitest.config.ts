import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte({ include: ['test/**/*.svelte'] })],
  resolve: { conditions: ['browser'] },
  test: {
    // Força o build de navegador do Solid/Svelte (o padrão do Node é o de SSR).
    server: { deps: { inline: [/solid-js/, /svelte/] } },
    include: ['test/**/*.test.{ts,tsx}'],
  },
})
