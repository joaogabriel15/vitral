import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/auto.ts', 'src/devtools.ts', 'src/element.ts', 'src/react.tsx', 'src/vue.ts', 'src/svelte.ts', 'src/preact.ts', 'src/solid.ts', 'src/angular.ts', 'src/testing.ts', 'src/vite.ts', 'src/cli.ts', 'src/routes.ts', 'src/iframe.ts', 'src/sentry.ts', 'src/otel.ts', 'src/single-spa.ts', 'src/federation.ts', 'src/edge.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    target: 'es2022',
    // Só o embed define: aqui `typeof __VITRAL_EMBED__` some do build.
    define: { __VITRAL_EMBED__: 'undefined' },
    // Frameworks são peer dependencies: nunca entram no bundle da lib.
    external: [/^react/, /^vue/, /^svelte/, /^preact/, /^solid-js/, /^@angular\//, 'vite', 'postcss', 'typescript'],
  },
  {
    // Loader para sites de terceiros (`<script src=".../embed.js" async>`):
    // arquivo único, sem chunks, que roda como script clássico.
    entry: { embed: 'src/embed.ts' },
    format: ['iife'],
    outExtension: () => ({ js: '.js' }),
    minify: true,
    target: 'es2022',
    // Widget de terceiros nunca vem do SSR do gateway: a hidratação fica de fora.
    // O `define` tira o `import()`; o plugin tira o módulo, que o esbuild
    // manteria no arquivo mesmo sem ninguém chamar.
    define: { __VITRAL_EMBED__: 'true' },
    esbuildPlugins: [
      {
        name: 'sem-hidratacao',
        setup(build) {
          build.onResolve({ filter: /\/core\/hydrate$/ }, () => ({ path: 'hydrate', namespace: 'sem-hidratacao' }))
          build.onLoad({ filter: /.*/, namespace: 'sem-hidratacao' }, () => ({ contents: 'export {}', loader: 'js' }))
        },
      },
    ],
  },
])
