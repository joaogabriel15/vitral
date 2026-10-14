import '@angular/compiler'
import { describe, expect, it } from 'vitest'

// A API pública não pode mudar sem querer: qualquer export novo ou removido
// aparece aqui e precisa de atualização consciente do snapshot.
const entries = {
  index: () => import('../src/index'),
  auto: () => import('../src/auto'),
  devtools: () => import('../src/devtools'),
  element: () => import('../src/element'),
  react: () => import('../src/react'),
  vue: () => import('../src/vue'),
  svelte: () => import('../src/svelte'),
  preact: () => import('../src/preact'),
  solid: () => import('../src/solid'),
  angular: () => import('../src/angular'),
  testing: () => import('../src/testing'),
  vite: () => import('../src/vite'),
}

describe('exports públicos', () => {
  for (const [name, load] of Object.entries(entries)) {
    it(name, async () => {
      const mod = await load()
      expect(Object.keys(mod).sort()).toMatchSnapshot()
    })
  }
})
