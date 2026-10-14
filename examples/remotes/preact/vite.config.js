import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import vitral from 'vitral/vite'

export default defineConfig({
  base: './',
  plugins: [preact(), vitral({ entry: 'src/remote.jsx', name: 'preact' })],
})
