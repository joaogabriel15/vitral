import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import ilha from 'arquipelago/vite'

export default defineConfig({
  base: './',
  plugins: [vue(), ilha({ entry: 'src/remote.js', name: 'vue' })],
})
