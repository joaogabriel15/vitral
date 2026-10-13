import { defineConfig } from 'vite'
import angular from '@analogjs/vite-plugin-angular'
import ilha from 'arquipelago/vite'

export default defineConfig({
  base: './',
  plugins: [angular({ tsconfig: new URL('./tsconfig.json', import.meta.url).pathname }), ilha({ entry: 'src/remote.ts', name: 'angular' })],
})
