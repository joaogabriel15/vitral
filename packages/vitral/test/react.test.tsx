// @vitest-environment happy-dom
import * as React from 'react'
import { act, createElement as h, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { register } from '../src/index'
import { reactRemote, Remote, useVitral } from '../src/react'
import { failingRemote, mockRemote } from '../src/testing'
import { cleanup, flush } from './helpers'
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
