// @vitest-environment happy-dom
import * as React from 'react'
import { act, createElement as h, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { register } from '../src/index'
import { preload, reactRemote, Remote, useInitialState, usePortalContainer, useVitral } from '../src/react'
import { ssrHolder } from '../src/core/ssr-markup'
import { reactRender } from '../src/react-server'
import { failingRemote, mockRemote } from '../src/testing'
import { cleanup, flush, serveManifest } from './helpers'
import { protocol } from '../src/core/state'

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
afterEach(cleanup)

async function render(node: React.ReactNode) {
  const div = document.body.appendChild(document.createElement('div'))
  const root = createRoot(div)
  await act(async () => root.render(node))
  await act(flush)
  return { div, root }
}

describe('React: host <Remote>', () => {
  it('oferece o grupo do React aos remotes com dedupe', async () => {
    mockRemote('a', () => {})
    await render(h(Remote, { name: 'a' }))
    await protocol().pending()
    const mods = (await protocol().dedupe!('react', `^${React.version}`))!
    expect(Object.keys(mods)).toEqual(['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react/compiler-runtime'])
    expect((mods.react as typeof React).useState).toBe(React.useState)
    expect(typeof (mods['react/compiler-runtime'] as any).c).toBe('function')
    // Versão de outro major não serve.
    expect(protocol().dedupe!('react', '^18.0.0')).toBeUndefined()
  })

  it('preload já oferece o React antes de algum <Remote> montar', async () => {
    mockRemote('b', () => {})
    preload('b')
    await protocol().pending()
    expect((await protocol().dedupe!('react', `^${React.version}`))!.react).toBe(React)
  })

  it('mostra fallback, monta e repassa props sem remontar', async () => {
    const m = mockRemote('a', (el, p) => (el.textContent = `n=${p.n}`))
    let set!: (n: number) => void
    function App() {
      const [n, setN] = useState(1)
      set = setN
      return h(Remote, { name: 'a', props: { n }, fallback: h('i', null, 'carregando') })
    }
    const { div } = await render(h(App))
    expect(div.textContent).toBe('n=1')
    await act(async () => set(2))
    expect(div.textContent).toBe('n=2')
    expect(m.mounts).toBe(1)
  })

  it('erro de carregamento vai para a prop error, com retry', async () => {
    failingRemote('b')
    const { div } = await render(
      h(Remote, { name: 'b', error: (e: any, retry: () => void) => h('button', { onClick: retry }, `erro ${e.code}`) }),
    )
    expect(div.textContent).toBe('erro MOUNT_FAILED')
    mockRemote('b', (el) => (el.textContent = 'ok'))
    await act(async () => div.querySelector('button')!.click())
    await act(flush)
    expect(div.textContent).toBe('ok')
  })
})

describe('React: reactRemote', () => {
  it('com CSS escopado, os portais no body ganham o escopo do remote (inclusive portal dentro de portal)', async () => {
    const { createPortal } = await import('react-dom')
    function Inner() {
      return createPortal(h('p', { id: 'interno' }, 'menu'), document.body)
    }
    function Dialog() {
      return h('section', null, createPortal(h('div', { id: 'dialog' }, h(Inner)), document.body))
    }
    const el = document.body.appendChild(document.createElement('div'))
    el.setAttribute('data-vitral-scope', 'delivery')
    const ctx = { name: 'delivery', portalContainer: document.body, reportError() {} } as any
    let mounted: any
    await act(async () => {
      mounted = await reactRemote(Dialog as any).mount(el, {}, ctx)
    })
    // O código dos portais chega num chunk à parte; o portal já aberto também ganha o escopo.
    await vi.waitFor(() => expect(document.getElementById('dialog')!.getAttribute('data-vitral-scope')).toBe('delivery'))
    expect(document.getElementById('interno')!.getAttribute('data-vitral-scope')).toBe('delivery')
    // Portal do host (outra raiz do React) não ganha o escopo.
    await render(createPortal(h('div', { id: 'host' }), document.body))
    expect(document.getElementById('host')!.hasAttribute('data-vitral-scope')).toBe(false)
    await act(async () => mounted.unmount())
    el.remove()
  })


  it('usePortalContainer devolve o destino de portais do contexto (no Shadow DOM, dentro do shadow root)', async () => {
    const seen: (HTMLElement | undefined)[] = []
    function Card() {
      seen.push(usePortalContainer())
      return null
    }
    register('card', { module: reactRemote(Card as any), isolate: 'shadow' })
    const { div } = await render(h(Remote, { name: 'card' }))
    // O módulo de Shadow DOM é baixado à parte; o act de cada volta deixa o React renderizar.
    await vi.waitFor(
      async () => {
        await act(flush)
        expect(seen).not.toHaveLength(0)
      },
      { timeout: 5000 },
    )
    const root = div.querySelector('[data-vitral-slot]')!.shadowRoot!
    expect(seen.at(-1)).toBe(root.querySelector('[data-vitral-portal]'))
    expect(seen.at(-1)!.getRootNode()).toBe(root)
    // Fora de um remote, a biblioteca usa o padrão dela.
    function Fora() {
      seen.push(usePortalContainer())
      return null
    }
    await render(h(Fora))
    expect(seen.at(-1)).toBeUndefined()
  })

  it('renderiza o componente, atualiza props, dá acesso ao contexto e reporta erro de render', async () => {
    function Card({ msg, boom }: { msg: string; boom?: boolean }) {
      const vitral = useVitral()
      if (boom) throw new Error('boom')
      return h('p', null, `${msg} (${vitral?.name})`)
    }
    register('card', { module: reactRemote(Card as any) })
    let set!: (p: any) => void
    function App() {
      const [p, setP] = useState<any>({ msg: 'oi' })
      set = setP
      return h(Remote, { name: 'card', props: p, error: (e: any) => h('b', null, e.code) })
    }
    const { div } = await render(h(App))
    expect(div.textContent).toBe('oi (card)')
    await act(async () => set({ msg: 'tchau' }))
    await act(flush)
    expect(div.textContent).toBe('tchau (card)')
    const orig = console.error
    console.error = () => {}
    await act(async () => set({ msg: 'x', boom: true }))
    await act(flush)
    console.error = orig
    expect(div.textContent).toBe('RENDER_FAILED')
  })
})

describe('React: SSR (reactRender + hydrate)', () => {
  function Contador({ inicio }: { inicio: number }) {
    const [n, setN] = useState(inicio)
    const id = React.useId()
    return h('button', { id, onClick: () => setN((x) => x + 1) }, `cliques: ${n}`)
  }

  it('hidrata o HTML de reactRender sem recriar nem avisar de diferença, e responde a cliques', async () => {
    const html = reactRender(Contador)({ inicio: 2 })
    expect(html).toMatch(/^<button id="[^"]+">cliques: 2<\/button>$/)
    const el = document.body.appendChild(document.createElement('div'))
    el.innerHTML = html
    const button = el.querySelector('button')!
    const erros: unknown[] = []
    const orig = console.error
    console.error = (...a: unknown[]) => erros.push(a)
    const ctx = { name: 'contador', reportError: vi.fn() } as any
    let handle!: { update?: (p: any) => void; unmount: () => void }
    await act(async () => {
      handle = await reactRemote(Contador).hydrate!(el, { inicio: 2 }, ctx)
    })
    console.error = orig
    expect(erros).toEqual([])
    expect(el.querySelector('button')).toBe(button)
    await act(async () => button.click())
    expect(button.textContent).toBe('cliques: 3')
    await act(async () => handle.update!({ inicio: 9 }))
    expect(button.textContent).toBe('cliques: 3')
    await act(async () => handle.unmount())
    expect(el.innerHTML).toBe('')
  })

  it('<Remote ssr>: o HTML aparece antes do JS, hidrata no mesmo nó e o estado do servidor chega aos dois lados', async () => {
    function Lista({ id }: { id: number }) {
      const itens = useInitialState<string[]>() ?? ['buscando']
      const [n, setN] = useState(0)
      return h('button', { onClick: () => setN((x) => x + 1) }, `${id}: ${itens.join(',')} ${n}`)
    }
    const rendered = await reactRender(Lista, { state: async ({ id }) => [`a${id}`, `b${id}`] })({ id: 7 })
    expect(rendered).toEqual({ html: '<button>7: a7,b7 0</button>', state: ['a7', 'b7'] })
    const markup = ssrHolder('lista', { scope: 'lista' }, rendered, [['/lista/s.css', 'sha384-x']])
    expect(markup).toContain('<script type="application/json" data-vitral-state>["a7","b7"]</script>')
    expect(markup).toContain('<link rel="stylesheet" href="/lista/s.css" crossorigin="anonymous" integrity="sha384-x">')
    const mod = reactRemote(Lista)
    const hydrate = vi.spyOn(mod, 'hydrate')
    register('lista', { module: mod })
    const { div } = await render(h(Remote, { name: 'lista', props: { id: 7 }, ssr: ssrHolder('lista', { scope: 'lista' }, rendered, []), fallback: h('p', null, 'Carregando') }))
    const button = div.querySelector('button')!
    expect(div.textContent).not.toContain('Carregando')
    await vi.waitFor(() => expect(hydrate).toHaveBeenCalled())
    expect(hydrate.mock.calls[0][2].initialState).toEqual(['a7', 'b7'])
    await act(flush)
    expect(div.querySelector('button')).toBe(button)
    await act(async () => button.click())
    expect(button.textContent).toBe('7: a7,b7 1')
    expect(div.querySelector('[data-vitral-root]')!.getAttribute('data-vitral-scope')).toBe('lista')
  })

  it('no servidor, useVitral() devolve null', () => {
    function Nome() {
      return h('p', null, String(useVitral()?.name ?? 'sem contexto'))
    }
    expect(reactRender(Nome)({})).toBe('<p>sem contexto</p>')
  })
})

describe('React: <Remote src>', () => {
  it('monta pela URL do manifesto, sem configure()', async () => {
    serveManifest('carrinho')
    const { div } = await render(h(Remote, { src: 'https://cdn.exemplo.com/c/vitral.json', props: { n: 1 } }))
    await vi.waitFor(() => expect(div.textContent).toBe('carrinho:1'))
    expect(div.querySelector('[data-vitral]')!.getAttribute('data-vitral')).toBe('https://cdn.exemplo.com/c/vitral.json')
  })
})
