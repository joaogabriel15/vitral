import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import ilha from 'ilha/vite'

export default defineConfig({
  base: './',
  plugins: [svelte(), ilha({ entry: 'src/remote.js', name: 'svelte' })],
})
