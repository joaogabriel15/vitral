// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineVitralElement, elementRemote } from '../src/element'
import { register } from '../src/index'
import { failingRemote, mockRemote } from '../src/testing'
import { cleanup, flush } from './helpers'

beforeAll(() => defineVitralElement())
afterEach(cleanup)

describe('<vitral-remote> (host universal)', () => {
  it('monta com props do atributo e atualiza pela propriedade sem remontar', async () => {
    const m = mockRemote('a', (el, p) => (el.textContent = `oi ${p.nome}`))
    document.body.innerHTML = `<vitral-remote name="a" props='{"nome":"Ana"}'><p slot="fallback">carregando</p></vitral-remote>`
    const el = document.querySelector('vitral-remote')!
    expect(el.querySelector('[slot=fallback]')!.hidden).toBe(false)
    await flush()
    expect(el.textContent).toContain('oi Ana')
    expect(el.getAttribute('data-vitral-status')).toBe('ready')
    expect(el.querySelector('[slot=fallback]')!.hidden).toBe(true)
    el.props = { nome: 'Bia' }
    expect(el.textContent).toContain('oi Bia')
    expect(m.mounts).toBe(1)
  })

  it('mostra o slot de erro, dispara vitral-error e recupera com retry()', async () => {
    failingRemote('b')
    document.body.innerHTML = `<vitral-remote name="b"><p slot="error">quebrou</p></vitral-remote>`
    const el = document.querySelector('vitral-remote')!
    const errors: unknown[] = []
    el.addEventListener('vitral-error', (e) => errors.push((e as CustomEvent).detail.error))
    await flush()
    expect(el.getAttribute('data-vitral-status')).toBe('error')
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
    document.body.innerHTML = `<vitral-remote name="a"></vitral-remote>`
    const el = document.querySelector('vitral-remote')!
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
    document.body.innerHTML = `<vitral-remote name="a" isolate="shadow"></vitral-remote>`
    // O CSS do Shadow DOM vem de um módulo à parte, importado na hora.
    await vi.waitFor(() => expect(document.querySelector('[data-vitral-slot]')!.shadowRoot?.querySelector('b')?.textContent).toBe('dentro'))
  })

  it('inherit-styles adota o CSS do host no shadow root', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('.base { color: red }')))
    mockRemote('a')
    document.body.innerHTML = `<vitral-remote name="a" isolate="shadow" inherit-styles="/assets/base.css  /assets/b.css"></vitral-remote>`
    await vi.waitFor(() => expect(document.querySelector('vitral-remote')!.getAttribute('data-vitral-status')).toBe('ready'))
    expect(document.querySelector('[data-vitral-slot]')!.shadowRoot!.adoptedStyleSheets).toHaveLength(2)
    expect(fetch).toHaveBeenCalledWith(new URL('/assets/base.css', document.baseURI).href, expect.anything())
    vi.unstubAllGlobals()
  })
})

describe('elementRemote (Web Component/Lit como remote)', () => {
  it('cria o elemento, passa props como propriedades e o contexto em .vitral', async () => {
    class Widget extends HTMLElement {
      vitral: unknown
      set mensagem(v: string) {
        this.textContent = v
      }
    }
    customElements.define('x-widget', Widget)
    register('w', { module: elementRemote('x-widget') })
    document.body.innerHTML = `<vitral-remote name="w" props='{"mensagem":"olá"}'></vitral-remote>`
    const el = document.querySelector('vitral-remote')!
    await flush()
    const w = el.querySelector('x-widget') as Widget
    expect(w.textContent).toBe('olá')
    expect((w.vitral as { name: string }).name).toBe('w')
    el.props = { mensagem: 'tchau' }
    expect(w.textContent).toBe('tchau')
  })
})

describe('props que mudam durante o download', () => {
  it('o remote recebe as props mais recentes ao terminar de montar', async () => {
    const m = mockRemote('a', (el, p) => (el.textContent = String(p.v)))
    document.body.innerHTML = `<vitral-remote name="a"></vitral-remote>`
    const el = document.querySelector('vitral-remote')!
    el.props = { v: 2 } // antes de o mount terminar
    await flush()
    expect(el.textContent).toBe('2')
    expect(m.lastProps).toEqual({ v: 2 })
  })
})
