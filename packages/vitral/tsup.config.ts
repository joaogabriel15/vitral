import { join } from 'node:path'
import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/auto.ts', 'src/devtools.ts', 'src/element.ts', 'src/react.tsx', 'src/next.tsx', 'src/next-host.tsx', 'src/next-config.ts', 'src/sw.ts', 'src/react-server.tsx', 'src/vue.ts', 'src/svelte.ts', 'src/preact.ts', 'src/solid.ts', 'src/angular.ts', 'src/testing.ts', 'src/vite.ts', 'src/cli.ts', 'src/routes.ts', 'src/iframe.ts', 'src/sentry.ts', 'src/otel.ts', 'src/vitals.ts', 'src/single-spa.ts', 'src/federation.ts', 'src/dict.ts', 'src/prefetch.ts', 'src/edge.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    target: 'es2022',
    // Só o embed define: aqui `typeof __VITRAL_EMBED__` some do build.
    define: { __VITRAL_EMBED__: 'undefined' },
    // Frameworks são peer dependencies: nunca entram no bundle da lib.
    external: [/^react/, /^next(\/|$)/, 'vitral-next-host-config', /^vue/, /^svelte/, /^preact/, /^solid-js/, /^@angular\//, 'vite', 'postcss', 'typescript', 'happy-dom'],
  },
  {
    // Loader para sites de terceiros (`<script src=".../embed.js" async>`):
    // arquivo único, sem chunks, que roda como script clássico.
    entry: { embed: 'src/embed.ts' },
    format: ['iife'],
    outExtension: () => ({ js: '.js' }),
    minify: true,
    target: 'es2022',
    // O modo reframe e a hidratação não entram no arquivo único. Widget de
    // terceiros nunca vem do SSR do gateway: o `define` tira o `import()` da
    // hidratação; o plugin tira o módulo, que o esbuild manteria no arquivo
    // mesmo sem ninguém chamar.
    define: { __VITRAL_EMBED__: 'true' },
    esbuildPlugins: [
      {
        name: 'embed-sem-reframe',
        setup(build) {
          build.onResolve({ filter: /^\.\/reframe$/ }, (args) => ({ path: join(args.resolveDir, 'reframe-embed.ts') }))
        },
      },
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
