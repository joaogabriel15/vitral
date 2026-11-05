import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

// Remote do host Next com Pages Router (examples/hosts/next-pages), servido pelo próprio host.
export default defineConfig({
  base: './',
  // i18n: um arquivo por língua; o host baixa só a aberta, e o i18next do host (dedupe) lê.
  plugins: [react(), vitral({ name: 'ns', dedupe: ['react', 'i18next', 'react-i18next'], i18n: 'src/locales/{lng}.json' })],
})
