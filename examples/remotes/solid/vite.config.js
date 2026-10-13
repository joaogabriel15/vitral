import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import ilha from 'arquipelago/vite'

export default defineConfig({
  base: './',
  plugins: [solid(), ilha({ entry: 'src/remote.jsx', name: 'solid' })],
})
