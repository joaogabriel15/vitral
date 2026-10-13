import { defineConfig } from 'vite'
import angular from '@analogjs/vite-plugin-angular'
export default defineConfig({ plugins: [angular({ tsconfig: new URL('./tsconfig.json', import.meta.url).pathname })] })
