import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import ilha from 'ilha/vite'

export default defineConfig({
  base: './',
  plugins: [preact(), ilha({ entry: 'src/remote.jsx', name: 'preact' })],
})
