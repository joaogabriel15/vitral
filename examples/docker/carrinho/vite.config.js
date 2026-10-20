import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default {
  base: './',
  plugins: [react(), vitral({ name: 'carrinho' })],
}
