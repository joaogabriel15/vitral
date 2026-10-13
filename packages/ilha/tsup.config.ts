import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/react.tsx', 'src/vue.ts', 'src/vite.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'es2020',
  external: ['react', 'react-dom', 'react-dom/client', 'vue', 'vite', 'ilha', 'postcss'],
})
