import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/auto.ts', 'src/devtools.ts', 'src/element.ts', 'src/react.tsx', 'src/vue.ts', 'src/svelte.ts', 'src/preact.ts', 'src/solid.ts', 'src/angular.ts', 'src/testing.ts', 'src/vite.ts', 'src/cli.ts', 'src/routes.ts', 'src/iframe.ts', 'src/sentry.ts', 'src/otel.ts', 'src/single-spa.ts', 'src/federation.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'es2022',
  // Frameworks são peer dependencies: nunca entram no bundle da lib.
  external: [/^react/, /^vue/, /^svelte/, /^preact/, /^solid-js/, /^@angular\//, 'vite', 'postcss', 'typescript'],
})
