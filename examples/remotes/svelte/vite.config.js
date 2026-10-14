import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import vitral from 'vitral/vite'

export default defineConfig({
  base: './',
  plugins: [svelte(), vitral({ entry: 'src/Cartao.svelte', name: 'svelte' })],
})
