import { defineConfig } from 'vite'

import ilha from 'ilha/vite'

export default defineConfig({
  base: './',
  plugins: [ilha({ entry: 'src/remote.js', name: 'lit' })],
})
