import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import ilha from 'ilha/vite'

export default defineConfig({
  base: './',
  plugins: [solid(), ilha({ entry: 'src/remote.jsx', name: 'solid' })],
})
