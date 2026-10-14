// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { __reset, configure, createEventBus, events, loadRemote, navigate, register, RemoteError } from '../src/index'

afterEach(() => {
  __reset()
  vi.unstubAllGlobals()
})

const fail = (p: Promise<unknown>) => p.then(() => { throw new Error('deveria falhar') }, (e) => e as RemoteError)

describe('eventos', () => {
  it('entrega, guarda o último valor e cancela a assinatura', () => {
    const bus = createEventBus()
    const got: number[] = []
    const off = bus.on<number>('n', (v) => got.push(v))
    bus.emit('n', 1)
    off()
    bus.emit('n', 2)
    expect(got).toEqual([1])
    expect(bus.last('n')).toBe(2)
  })

  it('um handler com erro não derruba os outros', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ok = vi.fn()
    events.on('x', () => { throw new Error('boom') })
    events.on('x', ok)
    events.emit('x', 1)
    expect(ok).toHaveBeenCalledWith(1)
    spy.mockRestore()
  })
})

describe('carregamento', () => {
  it('erro claro para remote não registrado', async () => {
    const e = await fail(loadRemote('nada'))
    expect(e.code).toBe('NOT_REGISTERED')
  })

  it('bloqueia origem fora da allowlist', async () => {
    configure({ allowedOrigins: ['https://cdn.empresa.com'] })
    register('x', 'https://malicioso.com/remote.js')
    expect((await fail(loadRemote('x'))).code).toBe('ORIGIN_BLOCKED')
  })

  it('bloqueia manifesto que aponta o JS para outra origem', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ name: 'x', entry: 'https://outro.com/r.js' }))))
    register('x', 'https://cdn.empresa.com/x/vitral.json')
    expect((await fail(loadRemote('x'))).code).toBe('ORIGIN_BLOCKED')
  })

  it('recusa código cujo hash não confere', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('export default { mount(){} }')))
    configure({ retries: 0 })
    register('x', { url: 'https://cdn.empresa.com/r.js', integrity: 'sha384-AAAA' })
    expect((await fail(loadRemote('x'))).code).toBe('INTEGRITY')
  })

  it('HTTP 404 vira LOAD_FAILED e não fica em cache', async () => {
    const fetch = vi.fn(async () => new Response('', { status: 404 }))
    vi.stubGlobal('fetch', fetch)
    configure({ retries: 0 })
    register('x', 'https://cdn.empresa.com/x/vitral.json')
    expect((await fail(loadRemote('x'))).code).toBe('LOAD_FAILED')
    await fail(loadRemote('x'))
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe('navegação', () => {
  it('navigate atualiza a URL e avisa os roteadores via popstate', () => {
    const seen: string[] = []
    addEventListener('popstate', () => seen.push(location.pathname))
    navigate('/pedidos/42')
    expect(location.pathname).toBe('/pedidos/42')
    expect(seen).toContain('/pedidos/42')
    expect(events.last('vitral:navigate')).toBe('/pedidos/42')
  })
})
