import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import ilha from 'arquipelago/vite'

export default defineConfig({
  base: './',
  plugins: [preact(), ilha({ entry: 'src/remote.jsx', name: 'preact' })],
})
