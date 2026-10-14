import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import vitral from 'vitral/vite'

export default defineConfig({
  base: './',
  plugins: [solid(), vitral({ entry: 'src/remote.jsx', name: 'solid' })],
})
