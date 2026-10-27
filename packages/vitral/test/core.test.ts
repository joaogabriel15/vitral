// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { __reset, configure, createEventBus, events, loadRemote, navigate, register, RemoteError } from '../src/index'
import { FIXTURE_REMOTE } from './helpers'
import { protocol } from '../src/core/state'

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

  it('integrity: false do host dispensa o hash do manifesto', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ name: 'x', entry: FIXTURE_REMOTE, integrity: 'sha384-AAAA' }))))
    configure({ retries: 0, allowedOrigins: ['*'] })
    register('x', 'https://cdn.empresa.com/x/vitral.json')
    expect((await fail(loadRemote('x'))).code).toBe('INTEGRITY')
    register('y', { url: 'https://cdn.empresa.com/y/vitral.json', integrity: false })
    expect(typeof (await loadRemote('y')).mount).toBe('function')
  })

  it('integrity: false usa o build dividido do manifesto', async () => {
    const manifest = { name: 'z', entry: 'file:///nao-existe.js', integrity: 'sha384-AAAA', split: { entry: FIXTURE_REMOTE, chunks: [] } }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(manifest))))
    configure({ retries: 0, allowedOrigins: ['*'] })
    register('z', { url: 'https://cdn.empresa.com/z/vitral.json', integrity: false })
    expect(typeof (await loadRemote('z')).mount).toBe('function')
  })

  it('integrity: false oferece as cópias de dedupe do build dividido', async () => {
    const manifest = {
      name: 'w', entry: 'file:///nao-existe.js', integrity: 'sha384-AAAA',
      split: { entry: FIXTURE_REMOTE, chunks: [] },
      dedupe: [{ name: 'lib', range: '^1.0.0', version: '1.0.0', file: FIXTURE_REMOTE }],
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(manifest))))
    configure({ retries: 0, allowedOrigins: ['*'] })
    register('w', { url: 'https://cdn.empresa.com/w/vitral.json', integrity: false })
    await loadRemote('w')
    expect(typeof (await protocol().dedupe!('lib', '^1.0.0')).mount).toBe('function')
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

describe('preload com routes', () => {
  it('routeChunks: só os JS lazy do build dividido, sem entrada, chunks da montagem, testes de SRI e cópias de dedupe', async () => {
    const { routeChunks } = await import('../src/core/loader')
    const d = 'https://cdn.x/r/split/'
    const sri = Object.fromEntries(['entry.js', 'a.js', 'rota.js', 'rota2.js', 'own.js', 'own-dep.js', 'p.js', 'x.css'].map((f) => [d + f, 'sha384-x']))
    sri['https://cdn.x/r/remote-unico.js'] = 'sha384-x'
    const split = { entry: d + 'entry.js', chunks: [d + 'a.js'], sri, probe: [d + 'p.js', d + 'p.js'] as [string, string], dedupe: [{ name: 'ui', range: '^1', version: '1.0.0', file: d + 'own.js', chunks: [d + 'own-dep.js'] }] }
    expect(routeChunks({ module: {} as any, entry: '', css: [], sri, split } as any)).toEqual([d + 'rota.js', d + 'rota2.js'])
    expect(routeChunks({ module: {} as any, entry: '', css: [], sri } as any)).toEqual([])
    // Com `lazy` no manifesto, vale a lista do build (chunks que o app e uma cópia de dedupe dividem entram).
    expect(routeChunks({ module: {} as any, entry: '', css: [], sri, split: { ...split, lazy: [d + 'rota.js', d + 'own-dep.js'] } } as any)).toEqual([d + 'rota.js', d + 'own-dep.js'])
  })
})
