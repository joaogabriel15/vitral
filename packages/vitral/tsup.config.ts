import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/element.ts', 'src/react.tsx', 'src/vue.ts', 'src/svelte.ts', 'src/preact.ts', 'src/solid.ts', 'src/angular.ts', 'src/testing.ts', 'src/vite.ts', 'src/routes.ts', 'src/iframe.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'es2022',
  // Frameworks são peer dependencies: nunca entram no bundle da lib.
  external: [/^react/, /^vue/, /^svelte/, /^preact/, /^solid-js/, /^@angular\//, 'vite', 'postcss'],
})
