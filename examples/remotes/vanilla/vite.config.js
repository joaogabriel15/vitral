import { defineConfig } from 'vite'

import ilha from 'ilha/vite'

export default defineConfig({
  base: './',
  plugins: [ilha({ entry: 'src/remote.ts', name: 'vanilla' })],
})
