import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vitral from 'vitral/vite'

export default defineConfig({
  base: './',
  plugins: [vue(), vitral({ entry: 'src/remote.js', name: 'vue' })],
})
