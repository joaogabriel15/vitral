import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

// O mesmo remote de sempre; com target: 'mcp-app' o build gera dist/mcp-app.html.
export default defineConfig({
  plugins: [react(), vitral({ name: 'clima', target: 'mcp-app' })],
})
