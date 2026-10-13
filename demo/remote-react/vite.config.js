import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import ilha from 'ilha/vite'

export default defineConfig({
  plugins: [react(), ilha({ entry: 'src/remote.jsx' })],
})
