import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vitral from 'vitral/vite'

export default defineConfig({
  plugins: [vue(), vitral({ entry: 'src/remote.js' })],
})
