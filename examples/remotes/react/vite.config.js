import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default defineConfig({
  base: './',
  plugins: [react(), vitral({ name: 'react' })],
})
