// Garante que os componentes de host renderizam no servidor (Next/Nuxt) sem tocar no DOM.
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToString as reactToString } from 'react-dom/server'
import { createSSRApp, h } from 'vue'
import { renderToString as vueToString } from 'vue/server-renderer'
import { Remote } from '../src/react'
import { VitralRemote } from '../src/vue'
import { provide, shared } from '../src/index'

describe('SSR', () => {
  it('React <Remote> renderiza o fallback no servidor', () => {
    const html = reactToString(createElement(Remote, { name: 'carrinho', fallback: createElement('p', null, 'carregando') }))
    expect(html).toContain('carregando')
    expect(html).toContain('data-vitral="carrinho"')
  })

  it('Vue <VitralRemote> renderiza o fallback no servidor', async () => {
    const app = createSSRApp({ render: () => h(VitralRemote, { name: 'carrinho' }, { fallback: () => h('p', 'carregando') }) })
    const html = await vueToString(app)
    expect(html).toContain('carregando')
    expect(html).toContain('data-vitral="carrinho"')
  })
})

describe('shared no servidor', () => {
  it('não guarda nada em variável global, para não vazar entre requisições', () => {
    const usuario = provide('usuario', { id: 42 })
    expect(usuario.get()).toEqual({ id: 42 })
    usuario.set({ id: 7 })
    expect(usuario.get()).toEqual({ id: 7 })
    expect(shared('usuario').get()).toBeUndefined()
    expect((globalThis as any)[Symbol.for('vitral')]?.shared).toBeUndefined()
  })
})
