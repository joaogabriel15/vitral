// @vitest-environment happy-dom
import { createEffect, createSignal, createComponent } from 'solid-js'
import { render } from 'solid-js/web'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { register } from '../src/index'
import { Remote, solidRemote } from '../src/solid'
import { failingRemote, mockRemote } from '../src/testing'
import { cleanup, flush, serveManifest } from './helpers'

afterEach(cleanup)

describe('Solid', () => {
  it('host <Remote> + solidRemote: props reativas sem remontar', async () => {
    let renders = 0
    const Card = (props: any) => {
      renders++
      const p = document.createElement('p')
      createEffect(() => (p.textContent = `${props.msg} (${props.vitral.name})`))
      return p
    }
    register('card', { module: solidRemote(Card) })
    const [msg, setMsg] = createSignal('oi')
    const div = document.body.appendChild(document.createElement('div'))
    render(() => createComponent(Remote, { name: 'card', get props() { return { msg: msg() } } }), div)
    await flush()
    expect(div.textContent).toBe('oi (card)')
    setMsg('tchau')
    await flush()
    expect(div.textContent).toBe('tchau (card)')
    expect(renders).toBe(1)
  })

  it('erro com retry', async () => {
    failingRemote('b')
    const div = document.body.appendChild(document.createElement('div'))
    render(
      () =>
        createComponent(Remote, {
          name: 'b',
          error: (e, retry) => {
            const b = document.createElement('button')
            b.textContent = e.code
            b.onclick = retry
            return b
          },
        }),
      div,
    )
    await flush()
    expect(div.textContent).toBe('MOUNT_FAILED')
    mockRemote('b', (el) => (el.textContent = 'ok'))
    div.querySelector('button')!.click()
    await flush()
    expect(div.textContent).toBe('ok')
  })
})

describe('Solid: <Remote src>', () => {
  it('monta pela URL do manifesto, sem configure()', async () => {
    serveManifest('carrinho')
    const div = document.body.appendChild(document.createElement('div'))
    render(() => createComponent(Remote, { src: 'https://cdn.exemplo.com/c/vitral.json', props: { n: 1 } }), div)
    await vi.waitFor(() => expect(div.textContent).toBe('carrinho:1'))
  })
})
