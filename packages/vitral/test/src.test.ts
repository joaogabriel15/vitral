// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { configure, createSlot, loadRemote, mountRemote, registerSrc, type RemoteError } from '../src/index'
import { defineVitralElement } from '../src/element'
import { protocol } from '../src/core/state'
import { failingRemote, mockRemote } from '../src/testing'
import { cleanup, flush, serveManifest as serve } from './helpers'

beforeAll(() => defineVitralElement())
afterEach(cleanup)

const fail = (p: Promise<unknown>) => p.then(() => { throw new Error('deveria falhar') }, (e) => e as RemoteError)

describe('registerSrc', () => {
  it('usa a URL como nome e não reinicia o cache ao repetir', async () => {
    const fetch = serve()
    const key = registerSrc('https://cdn.exemplo.com/carrinho/vitral.json')
    expect(key).toBe('https://cdn.exemplo.com/carrinho/vitral.json')
    await loadRemote(key)
    expect(registerSrc('https://cdn.exemplo.com/carrinho/vitral.json')).toBe(key)
    await loadRemote(key)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('com name, registra sob esse nome', () => {
    expect(registerSrc('/x/vitral.json', 'x')).toBe('x')
    expect(protocol().entry('x')?.url).toBe(new URL('/x/vitral.json', location.href).href)
  })

  it('o nome do manifesto vira apelido e chega em ctx.name', async () => {
    serve('carrinho')
    const host = document.body.appendChild(document.createElement('div'))
    const key = registerSrc('https://cdn.exemplo.com/c/vitral.json')
    await mountRemote(host, key, { n: 1 })
    expect(host.textContent).toBe('carrinho:1')
    expect(host.querySelector('[data-vitral-root="carrinho"]')).not.toBeNull()
    expect(protocol().entry('carrinho')?.url).toBe(key)
  })

  it('não sobrepõe um nome já registrado com o apelido', async () => {
    serve('carrinho')
    mockRemote('carrinho')
    await loadRemote(registerSrc('https://cdn.exemplo.com/c/vitral.json'))
    expect(protocol().entry('carrinho')?.module).toBeDefined()
  })

  it('URL escrita no código entra na allowlist, mesmo com allowedOrigins', async () => {
    serve('x', 'https://cdn.exemplo.com/c/r.js')
    configure({ allowedOrigins: ['https://outro.com'], retries: 0 })
    const e = await fail(loadRemote(registerSrc('https://cdn.exemplo.com/c/vitral.json')))
    // Passou da allowlist: o erro é do import (Node não importa https:), não ORIGIN_BLOCKED.
    expect(e.code).toBe('LOAD_FAILED')
    expect(e.message).toContain('https://cdn.exemplo.com/c/r.js')
  })

  it('a origem confiável não libera um JS de outra origem no manifesto', async () => {
    serve('x', 'https://malicioso.com/r.js')
    configure({ allowedOrigins: ['https://outro.com'] })
    expect((await fail(loadRemote(registerSrc('https://cdn.exemplo.com/c/vitral.json')))).code).toBe('ORIGIN_BLOCKED')
  })

  it('sem trusted, a URL passa pela allowlist', async () => {
    configure({ allowedOrigins: ['https://outro.com'] })
    const key = registerSrc('https://cdn.exemplo.com/c/vitral.json', undefined, false)
    expect((await fail(loadRemote(key))).code).toBe('ORIGIN_BLOCKED')
  })
})

describe('createSlot com src', () => {
  it('monta pela URL e remonta ao trocar o src', async () => {
    serve('a')
    const target = document.body.appendChild(document.createElement('div'))
    const slot = createSlot(target, { src: 'https://cdn.exemplo.com/a/vitral.json', props: { n: 1 } })
    await vi.waitFor(() => expect(target.textContent).toBe('a:1'))
    serve('b')
    slot.set({ src: 'https://cdn.exemplo.com/b/vitral.json' })
    await vi.waitFor(() => expect(target.textContent).toBe('b:1'))
    slot.set({ isolate: undefined })
    expect(slot.status).toBe('ready')
  })

  it('sem name nem src, falha com NOT_REGISTERED', async () => {
    const statuses: string[] = []
    createSlot(document.body, { onStatus: (s, e) => statuses.push(`${s}:${e?.code ?? ''}`) })
    await flush()
    expect(statuses).toEqual(['loading:', 'error:NOT_REGISTERED'])
  })
})

describe('<vitral-remote src>', () => {
  it('monta só com o src, sem registrar nada', async () => {
    serve('carrinho')
    document.body.innerHTML = `<vitral-remote src="https://cdn.exemplo.com/c/vitral.json" props='{"n":2}'></vitral-remote>`
    const el = document.querySelector('vitral-remote')!
    await vi.waitFor(() => expect(el.textContent).toBe('carrinho:2'))
    expect(el.getAttribute('data-vitral-status')).toBe('ready')
  })

  it('src em atributo não entra na allowlist quando há allowedOrigins', async () => {
    configure({ allowedOrigins: ['https://outro.com'] })
    document.body.innerHTML = `<vitral-remote src="https://cdn.exemplo.com/c/vitral.json"></vitral-remote>`
    const el = document.querySelector('vitral-remote')!
    const errors: RemoteError[] = []
    el.addEventListener('vitral-error', (e) => errors.push((e as CustomEvent).detail.error))
    await flush()
    expect(errors[0].code).toBe('ORIGIN_BLOCKED')
  })

  it('trocar o src remonta', async () => {
    serve((url) => url.split('/')[3])
    document.body.innerHTML = `<vitral-remote src="https://cdn.exemplo.com/a/vitral.json"></vitral-remote>`
    const el = document.querySelector('vitral-remote')!
    await vi.waitFor(() => expect(el.textContent).toBe('a:'))
    el.setAttribute('src', 'https://cdn.exemplo.com/b/vitral.json')
    await vi.waitFor(() => expect(el.textContent).toBe('b:'))
  })
})

describe('carregando e erro padrão', () => {
  it('mostra um carregando acessível e some ao montar', async () => {
    mockRemote('a', (el) => (el.textContent = 'pronto'))
    document.body.innerHTML = `<vitral-remote name="a"></vitral-remote>`
    const el = document.querySelector('vitral-remote')!
    await Promise.resolve()
    const loading = el.querySelector('[data-vitral-default="loading"]')!
    expect(loading.getAttribute('role')).toBe('status')
    expect(loading.textContent).toBe('Carregando…')
    expect(el.getAttribute('aria-busy')).toBe('true')
    await flush()
    expect(el.querySelector('[data-vitral-default]')).toBeNull()
    expect(el.hasAttribute('aria-busy')).toBe(false)
    expect(el.textContent).toBe('pronto')
  })

  it('erro com "Tentar de novo" que remonta', async () => {
    failingRemote('b')
    document.body.innerHTML = `<vitral-remote name="b"></vitral-remote>`
    const el = document.querySelector('vitral-remote')!
    await flush()
    const box = el.querySelector('[data-vitral-default="error"]')!
    expect(box.getAttribute('role')).toBe('alert')
    expect(box.textContent).toContain('Não foi possível carregar.')
    mockRemote('b', (n) => (n.textContent = 'voltou'))
    box.querySelector('button')!.click()
    await flush()
    expect(el.textContent).toBe('voltou')
  })

  it('com slots próprios, não mostra os padrões', async () => {
    failingRemote('b')
    document.body.innerHTML = `<vitral-remote name="b"><p slot="fallback">…</p><p slot="error">x</p></vitral-remote>`
    const el = document.querySelector('vitral-remote')!
    expect(el.querySelector('[data-vitral-default]')).toBeNull()
    await flush()
    expect(el.querySelector('[data-vitral-default]')).toBeNull()
  })

  it('remover o elemento tira o padrão', async () => {
    failingRemote('b')
    document.body.innerHTML = `<vitral-remote name="b"></vitral-remote>`
    const el = document.querySelector('vitral-remote')!
    await flush()
    el.remove()
    await flush()
    expect(el.querySelector('[data-vitral-default]')).toBeNull()
  })
})

describe('vitral/auto', () => {
  it('define o <vitral-remote> ao ser importado', async () => {
    await import('../src/auto')
    expect(customElements.get('vitral-remote')).toBeDefined()
  })
})
