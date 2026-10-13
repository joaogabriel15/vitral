import { defineConfig } from 'vite'

import ilha from 'arquipelago/vite'

export default defineConfig({
  base: './',
  plugins: [ilha({ entry: 'src/remote.js', name: 'lit' })],
})
