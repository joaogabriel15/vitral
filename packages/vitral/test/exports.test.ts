import '@angular/compiler'
import { describe, expect, it } from 'vitest'

// A API pública não pode mudar sem querer: qualquer export novo ou removido
// aparece aqui e precisa de atualização consciente do snapshot.
const entries = {
  index: () => import('../src/index'),
  auto: () => import('../src/auto'),
  devtools: () => import('../src/devtools'),
  element: () => import('../src/element'),
  routes: () => import('../src/routes'),
  iframe: () => import('../src/iframe'),
  react: () => import('../src/react'),
  'react-server': () => import('../src/react-server'),
  vue: () => import('../src/vue'),
  svelte: () => import('../src/svelte'),
  preact: () => import('../src/preact'),
  solid: () => import('../src/solid'),
  angular: () => import('../src/angular'),
  testing: () => import('../src/testing'),
  vite: () => import('../src/vite'),
  sentry: () => import('../src/sentry'),
  otel: () => import('../src/otel'),
  vitals: () => import('../src/vitals'),
  'single-spa': () => import('../src/single-spa'),
  federation: () => import('../src/federation'),
  next: () => import('../src/next'),
  'next-config': () => import('../src/next-config'),
  sw: () => import('../src/sw'),
  dict: () => import('../src/dict'),
  prefetch: () => import('../src/prefetch'),
  edge: () => import('../src/edge'),
}

describe('exports públicos', () => {
  for (const [name, load] of Object.entries(entries)) {
    it(name, async () => {
      const mod = await load()
      expect(Object.keys(mod).sort()).toMatchSnapshot()
    })
  }
})
