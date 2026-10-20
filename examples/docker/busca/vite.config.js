import vue from '@vitejs/plugin-vue'
import vitral from 'vitral/vite'

export default {
  base: './',
  plugins: [vue(), vitral({ name: 'busca' })],
}
