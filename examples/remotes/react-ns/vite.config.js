import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

// Remote do host Next com Pages Router (examples/hosts/next-pages), servido pelo próprio host.
export default defineConfig({
  base: './',
  plugins: [react(), vitral({ name: 'ns', dedupe: ['react'] })],
})
