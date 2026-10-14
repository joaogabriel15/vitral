// @vitest-environment happy-dom
import { h, render } from 'preact'
import { useState } from 'preact/hooks'
import { act } from 'preact/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { register } from '../src/index'
import { preactRemote, Remote } from '../src/preact'
import { failingRemote, mockRemote } from '../src/testing'
import { cleanup, flush } from './helpers'

afterEach(cleanup)

describe('Preact', () => {
  it('host <Remote> + preactRemote: monta, atualiza props sem remontar', async () => {
    const Card = ({ msg, vitral }: any) => h('p', null, `${msg} (${vitral.name})`)
    register('card', { module: preactRemote(Card) })
    let set!: (v: string) => void
    function App() {
      const [msg, setMsg] = useState('oi')
      set = setMsg
      return h(Remote, { name: 'card', props: { msg }, fallback: 'carregando' })
    }
    const div = document.body.appendChild(document.createElement('div'))
    await act(() => render(h(App, {}), div))
    expect(div.textContent).toBe('carregando')
    await act(flush)
    expect(div.textContent).toBe('oi (card)')
    await act(() => set('tchau'))
    expect(div.textContent).toBe('tchau (card)')
  })

  it('erro com retry', async () => {
    failingRemote('b')
    const div = document.body.appendChild(document.createElement('div'))
    await act(() => render(h(Remote, { name: 'b', error: (e: any, retry: any) => h('button', { onClick: retry }, e.code) }), div))
    await act(flush)
    expect(div.textContent).toBe('MOUNT_FAILED')
    mockRemote('b', (el) => (el.textContent = 'ok'))
    await act(() => div.querySelector('button')!.click())
    await act(flush)
    expect(div.textContent).toBe('ok')
  })
})
