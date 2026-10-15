import { defineConfig } from 'vite'

import vitral from 'vitral/vite'

export default defineConfig({
  base: './',
  plugins: [vitral({ name: 'lit' })],
})
