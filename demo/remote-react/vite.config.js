import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import ilha from 'arquipelago/vite'

export default defineConfig({
  plugins: [react(), tailwindcss(), ilha({ entry: 'src/remote.jsx' })],
})
