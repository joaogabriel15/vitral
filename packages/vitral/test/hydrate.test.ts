// @vitest-environment happy-dom
// Hidratação do HTML que o gateway (`vitral/edge`) renderizou no servidor.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineVitralElement } from '../src/element'
import { refresh, register, type MountedRemote, type RemoteContext, type RemoteModule } from '../src/index'
import { cleanup, flush } from './helpers'

beforeAll(async () => {
  defineVitralElement()
  // O primeiro import() do módulo passa pelo transform do Vitest, mais lento que os flush().
  await Promise.all([import('../src/core/hydrate'), import('../src/core/shadow')])
})
afterEach(cleanup)

/**
 * O que o gateway escreve. O happy-dom não cria shadow root declarativo, então
 * o shadow root é criado aqui, com o mesmo conteúdo do `<template shadowrootmode>`.
 */
function ssrElement(name: string, { isolate = 'shadow', html = '<button>itens: 1</button>', props = '{"n":1}' } = {}) {
  const el = document.createElement('vitral-remote')
  el.setAttribute('name', name)
  if (isolate) el.setAttribute('isolate', isolate)
  el.setAttribute('props', props)
  const holder = document.createElement('div')
  holder.setAttribute('data-vitral-ssr', '')
  holder.setAttribute('data-vitral-slot', name)
  const root = document.createElement('div')
  root.setAttribute('data-vitral-root', name)
  root.style.display = 'contents'
  root.innerHTML = html
  if (isolate === 'shadow') {
    const shadow = holder.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.setAttribute('data-vitral-ssr', '')
    style.textContent = '.a{color:red}'
    shadow.append(style, root)
  } else holder.append(root)
  const fallback = document.createElement('p')
  fallback.slot = 'fallback'
  fallback.hidden = true
  fallback.textContent = 'Carregando'
  el.append(holder, fallback)
  return { el, holder, root, button: root.querySelector('button')!, fallback }
}

function remote(withHydrate = true) {
  const calls: string[] = []
  const unmount = vi.fn()
  const update = vi.fn()
  let ctx: RemoteContext | undefined
  const mod: RemoteModule = {
    mount: vi.fn((el: HTMLElement, props: Record<string, unknown>) => {
      calls.push('mount')
      el.innerHTML = `<button>itens: ${props.n}</button>`
      return { update, unmount }
    }),
  }
  if (withHydrate)
    mod.hydrate = vi.fn((el: HTMLElement, _props, c): MountedRemote => {
      calls.push('hydrate')
      ctx = c
      el.querySelector('button')!.onclick = () => calls.push('click')
      return { update, unmount }
    })
  return { mod, calls, unmount, update, ctx: () => ctx! }
}

describe('hidratação do SSR', () => {
  it('Shadow DOM: chama hydrate com a raiz do servidor, sem remontar', async () => {
    const r = remote()
    const fetch = vi.fn(async (_url: string) => new Response('.a{color:blue}'))
    vi.stubGlobal('fetch', fetch)
    register('carrinho', { module: r.mod, isolate: 'shadow', css: ['https://cdn.exemplo.com/a.css'] })
    const { el, holder, root, button, fallback } = ssrElement('carrinho')
    const ready = vi.fn()
    el.addEventListener('vitral-ready', ready)
    document.body.append(el)
    await flush(10)
    expect(fetch.mock.calls.map((c) => c[0])).toEqual(['https://cdn.exemplo.com/a.css'])
    expect(r.calls).toEqual(['hydrate'])
    expect(r.mod.hydrate).toHaveBeenCalledWith(root, { n: 1 }, expect.anything())
    // Os mesmos nós do servidor, ainda no lugar.
    expect(holder.shadowRoot!.querySelector('[data-vitral-root]')).toBe(root)
    expect(root.querySelector('button')).toBe(button)
    expect(el.querySelectorAll('[data-vitral-slot]')).toHaveLength(1)
    expect(r.ctx().shadowRoot).toBe(holder.shadowRoot)
    expect(r.ctx().portalContainer!.hasAttribute('data-vitral-portal')).toBe(true)
    // CSS adotado: o <style> do servidor sai.
    expect(holder.shadowRoot!.adoptedStyleSheets).toHaveLength(1)
    expect(holder.shadowRoot!.querySelector('style[data-vitral-ssr]')).toBeNull()
    expect(fallback.hidden).toBe(true)
    expect(el.getAttribute('data-vitral-status')).toBe('ready')
    expect(ready).toHaveBeenCalled()
    button.click()
    expect(r.calls).toContain('click')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    r.ctx().reportError(new Error('render'))
    expect(spy.mock.calls[0][0].code).toBe('RENDER_FAILED')
    spy.mockRestore()
    const active = vi.fn()
    r.ctx().onActivate!(active)()

    el.props = { n: 2 }
    expect(r.update).toHaveBeenCalledWith({ n: 2 })
    el.remove()
    await flush()
    expect(r.unmount).toHaveBeenCalledOnce()
    expect(holder.isConnected).toBe(false)
  })

  it('sem isolamento: a raiz fica direto no holder', async () => {
    const r = remote()
    register('carrinho', { module: r.mod })
    const { el, root } = ssrElement('carrinho', { isolate: '' })
    document.body.append(el)
    await flush(10)
    expect(r.mod.hydrate).toHaveBeenCalledWith(root, { n: 1 }, expect.objectContaining({ shadowRoot: null, portalContainer: document.body }))
  })

  it('remote sem hydrate: monta do jeito normal e tira o HTML do servidor depois', async () => {
    const r = remote(false)
    register('carrinho', { module: r.mod, isolate: 'shadow' })
    const { el, holder, fallback } = ssrElement('carrinho')
    const status: string[] = []
    el.addEventListener('vitral-ready', () => status.push('ready'))
    document.body.append(el)
    await flush(10)
    expect(r.calls).toEqual(['mount'])
    expect(holder.isConnected).toBe(false)
    expect(fallback.hidden).toBe(true)
    const slot = el.querySelector('[data-vitral-slot]')!
    expect(slot.shadowRoot!.querySelector('button')!.textContent).toBe('itens: 1')
    expect(status).toEqual(['ready'])
  })

  it('DOM que não bate com o isolamento: monta do jeito normal', async () => {
    const r = remote()
    register('carrinho', { module: r.mod, isolate: 'shadow' })
    const { el } = ssrElement('carrinho', { isolate: '' })
    el.setAttribute('isolate', 'shadow')
    document.body.append(el)
    await flush(10)
    expect(r.calls).toEqual(['mount'])
  })

  it('props que mudam antes do hydrate terminar vão para o remote', async () => {
    const r = remote()
    let resolve!: (h: MountedRemote) => void
    r.mod.hydrate = vi.fn(() => new Promise<MountedRemote>((ok) => (resolve = ok)))
    register('carrinho', { module: r.mod, isolate: 'shadow' })
    const { el } = ssrElement('carrinho')
    document.body.append(el)
    await flush(10)
    el.props = { n: 5 }
    resolve({ update: r.update, unmount: r.unmount })
    await flush()
    expect(r.update).toHaveBeenCalledWith({ n: 5 })
  })

  it('hydrate que lança: erro, e "tentar de novo" monta do zero', async () => {
    const r = remote()
    r.mod.hydrate = () => {
      throw new Error('quebrou')
    }
    register('carrinho', { module: r.mod, isolate: 'shadow' })
    const { el, holder } = ssrElement('carrinho')
    const errors: string[] = []
    el.addEventListener('vitral-error', (e) => errors.push((e as CustomEvent).detail.error.code))
    document.body.append(el)
    await flush(10)
    expect(errors).toEqual(['MOUNT_FAILED'])
    expect(holder.isConnected).toBe(false)
    expect(el.getAttribute('data-vitral-status')).toBe('error')
    el.retry()
    await flush(10)
    expect(r.calls).toEqual(['mount'])
    expect(el.status).toBe('ready')
  })

  it('trocar o nome remonta o outro remote; retry depois do hydrate remonta', async () => {
    const a = remote()
    const b = remote()
    register('a', { module: a.mod, isolate: 'shadow' })
    register('b', { module: b.mod, isolate: 'shadow' })
    const { el } = ssrElement('a')
    document.body.append(el)
    await flush(10)
    el.setAttribute('isolate', 'shadow')
    expect(a.unmount).not.toHaveBeenCalled()
    el.setAttribute('name', 'b')
    await flush(10)
    expect(a.unmount).toHaveBeenCalledOnce()
    expect(b.calls).toEqual(['mount'])
    el.setAttribute('name', 'a')
    await flush(10)
    expect(a.calls).toEqual(['hydrate', 'mount'])

    const c = remote()
    register('c', { module: c.mod, isolate: 'shadow' })
    const second = ssrElement('c').el
    document.body.append(second)
    await flush(10)
    second.retry()
    await flush(10)
    expect(c.calls).toEqual(['hydrate', 'mount'])
    second.props = { n: 9 }
    expect(c.update).toHaveBeenLastCalledWith({ n: 9 })
  })

  it('refresh troca a versão hidratada por uma montagem normal', async () => {
    const r = remote()
    register('carrinho', { module: r.mod, isolate: 'shadow' })
    const { el, holder, root } = ssrElement('carrinho')
    document.body.append(el)
    await flush(10)
    expect(r.calls).toEqual(['hydrate'])
    const next = remote(false)
    register('carrinho', { module: next.mod, isolate: 'shadow' })
    await refresh('carrinho')
    expect(next.calls).toEqual(['mount'])
    expect(r.unmount).toHaveBeenCalledOnce()
    expect(root.isConnected).toBe(false)
    expect(holder.shadowRoot!.querySelectorAll('[data-vitral-root]:not([data-vitral-portal])')).toHaveLength(1)
  })

  it('elemento que sai da página antes do módulo chegar não monta', async () => {
    const r = remote()
    register('carrinho', { module: r.mod, isolate: 'shadow' })
    const { el } = ssrElement('carrinho')
    document.body.append(el)
    el.remove()
    await flush(10)
    expect(r.calls).toEqual([])
  })

  it('remote que não carrega: erro no elemento', async () => {
    const { el } = ssrElement('inexistente')
    const errors: string[] = []
    el.addEventListener('vitral-error', (e) => errors.push((e as CustomEvent).detail.error.code))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    document.body.append(el)
    await flush(10)
    expect(errors).toEqual(['NOT_REGISTERED'])
  })

  it('removido enquanto hidrata: desmonta quando o hydrate termina', async () => {
    const r = remote()
    let resolve!: (h: MountedRemote) => void
    r.mod.hydrate = vi.fn(() => new Promise<MountedRemote>((ok) => (resolve = ok)))
    register('carrinho', { module: r.mod, isolate: 'shadow' })
    const { el } = ssrElement('carrinho')
    document.body.append(el)
    await flush(10)
    el.remove()
    await flush()
    resolve({ unmount: r.unmount })
    await flush()
    expect(r.unmount).toHaveBeenCalledOnce()
  })
})
