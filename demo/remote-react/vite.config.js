import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import vitral from 'vitral/vite'

export default defineConfig({
  plugins: [react(), tailwindcss(), vitral({ entry: 'src/remote.jsx' })],
})
