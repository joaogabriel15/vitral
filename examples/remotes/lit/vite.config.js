import { defineConfig } from 'vite'

import vitral from 'vitral/vite'

export default defineConfig({
  base: './',
  plugins: [vitral({ entry: 'src/remote.js', name: 'lit' })],
})
