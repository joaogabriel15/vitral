import { defineConfig } from 'vite'
import angular from '@analogjs/vite-plugin-angular'
import vitral from 'vitral/vite'

export default defineConfig({
  base: './',
  plugins: [angular({ tsconfig: new URL('./tsconfig.json', import.meta.url).pathname }), vitral({ entry: 'src/remote.ts', name: 'angular' })],
})
