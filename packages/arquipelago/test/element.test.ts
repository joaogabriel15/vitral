// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { defineIlhaElement, elementRemote } from '../src/element'
import { register } from '../src/index'
import { failingRemote, mockRemote } from '../src/testing'
import { cleanup, flush } from './helpers'

beforeAll(() => defineIlhaElement())
afterEach(cleanup)

describe('<ilha-remote> (host universal)', () => {
  it('monta com props do atributo e atualiza pela propriedade sem remontar', async () => {
    const m = mockRemote('a', (el, p) => (el.textContent = `oi ${p.nome}`))
    document.body.innerHTML = `<ilha-remote name="a" props='{"nome":"Ana"}'><p slot="fallback">carregando</p></ilha-remote>`
    const el = document.querySelector('ilha-remote')!
    expect(el.querySelector('[slot=fallback]')!.hidden).toBe(false)
    await flush()
    expect(el.textContent).toContain('oi Ana')
    expect(el.getAttribute('data-ilha-status')).toBe('ready')
    expect(el.querySelector('[slot=fallback]')!.hidden).toBe(true)
    el.props = { nome: 'Bia' }
    expect(el.textContent).toContain('oi Bia')
    expect(m.mounts).toBe(1)
  })

  it('mostra o slot de erro, dispara ilha-error e recupera com retry()', async () => {
    failingRemote('b')
    document.body.innerHTML = `<ilha-remote name="b"><p slot="error">quebrou</p></ilha-remote>`
    const el = document.querySelector('ilha-remote')!
    const errors: unknown[] = []
    el.addEventListener('ilha-error', (e) => errors.push((e as CustomEvent).detail.error))
    await flush()
    expect(el.getAttribute('data-ilha-status')).toBe('error')
    expect(el.querySelector<HTMLElement>('[slot=error]')!.hidden).toBe(false)
    expect(errors).toHaveLength(1)
    mockRemote('b', (n) => (n.textContent = 'voltou'))
    el.retry()
    await flush()
    expect(el.textContent).toContain('voltou')
  })

  it('trocar o atributo name remonta; remover do DOM desmonta', async () => {
    const a = mockRemote('a')
    const b = mockRemote('b')
    document.body.innerHTML = `<ilha-remote name="a"></ilha-remote>`
    const el = document.querySelector('ilha-remote')!
    await flush()
    el.setAttribute('name', 'b')
    await flush()
    expect(a.mounted).toBe(false)
    expect(b.mounted).toBe(true)
    el.remove()
    await flush()
    expect(b.mounted).toBe(false)
  })

  it('isolate="shadow" monta dentro de um shadow root', async () => {
    mockRemote('a', (el) => (el.innerHTML = '<b>dentro</b>'))
    document.body.innerHTML = `<ilha-remote name="a" isolate="shadow"></ilha-remote>`
    await flush()
    const holder = document.querySelector('[data-ilha-slot]')!
    expect(holder.shadowRoot?.querySelector('b')?.textContent).toBe('dentro')
  })
})

describe('elementRemote (Web Component/Lit como remote)', () => {
  it('cria o elemento, passa props como propriedades e o contexto em .ilha', async () => {
    class Widget extends HTMLElement {
      ilha: unknown
      set mensagem(v: string) {
        this.textContent = v
      }
    }
    customElements.define('x-widget', Widget)
    register('w', { module: elementRemote('x-widget') })
    document.body.innerHTML = `<ilha-remote name="w" props='{"mensagem":"olá"}'></ilha-remote>`
    const el = document.querySelector('ilha-remote')!
    await flush()
    const w = el.querySelector('x-widget') as Widget
    expect(w.textContent).toBe('olá')
    expect((w.ilha as { name: string }).name).toBe('w')
    el.props = { mensagem: 'tchau' }
    expect(w.textContent).toBe('tchau')
  })
})

describe('props que mudam durante o download', () => {
  it('o remote recebe as props mais recentes ao terminar de montar', async () => {
    const m = mockRemote('a', (el, p) => (el.textContent = String(p.v)))
    document.body.innerHTML = `<ilha-remote name="a"></ilha-remote>`
    const el = document.querySelector('ilha-remote')!
    el.props = { v: 2 } // antes de o mount terminar
    await flush()
    expect(el.textContent).toBe('2')
    expect(m.lastProps).toEqual({ v: 2 })
  })
})
