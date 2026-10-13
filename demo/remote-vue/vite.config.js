import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import ilha from 'ilha/vite'

export default defineConfig({
  plugins: [vue(), ilha({ entry: 'src/remote.js' })],
})
