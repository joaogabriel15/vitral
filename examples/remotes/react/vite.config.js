import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import ilha from 'arquipelago/vite'

export default defineConfig({
  base: './',
  plugins: [react(), ilha({ entry: 'src/remote.jsx', name: 'react' })],
})
