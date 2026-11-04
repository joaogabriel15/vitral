// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { configure, loadRemote, register } from '../src/index'
import { cleanup, FIXTURE_REMOTE } from './helpers'

afterEach(cleanup)

const URL_M = 'https://cdn.empresa.com/carrinho/vitral.json'
const KEY = 'vitral:manifest:' + URL_M

/** fetch falso: o manifesto só chega com `release()`. */
function network() {
  let release = () => {}
  const fetch = vi.fn(
    () => new Promise<Response>((resolve) => (release = () => resolve(new Response(JSON.stringify({ name: 'carrinho', entry: FIXTURE_REMOTE, version: '2' }))))),
  )
  vi.stubGlobal('fetch', fetch)
  return { fetch, release: () => release() }
}

function setup(maxStale?: number) {
  configure({ allowedOrigins: ['*'], retries: 0, maxStale })
  register('carrinho', URL_M)
}

describe('maxStale', () => {
  it('com a cópia salva recente, carrega sem esperar a rede e atualiza a cópia por trás', async () => {
    localStorage[KEY] = JSON.stringify({ t: Date.now() - 10_000, m: { name: 'carrinho', entry: FIXTURE_REMOTE, version: '1' } })
    const net = network()
    setup(60)
    const mod = await loadRemote('carrinho')
    expect(typeof mod.mount).toBe('function')
    expect(net.fetch).toHaveBeenCalledTimes(1)
    expect(net.fetch.mock.calls[0][1]).toMatchObject({ cache: 'no-cache' })
    net.release()
    await vi.waitFor(() => expect(JSON.parse(localStorage[KEY]).m.version).toBe('2'))
  })

  it('com a cópia velha demais, espera o manifesto novo', async () => {
    localStorage[KEY] = JSON.stringify({ t: Date.now() - 120_000, m: { name: 'carrinho', entry: FIXTURE_REMOTE, version: '1' } })
    const net = network()
    setup(60)
    let done = false
    const loading = loadRemote('carrinho').then(() => (done = true))
    await vi.waitFor(() => expect(net.fetch).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 20))
    expect(done).toBe(false)
    net.release()
    await loading
    expect(JSON.parse(localStorage[KEY]).m.version).toBe('2')
  })

  it('sem maxStale, nem lê nem grava cópia', async () => {
    localStorage[KEY] = JSON.stringify({ t: Date.now(), m: { name: 'carrinho', entry: 'https://outro.com/velho.js' } })
    const net = network()
    setup()
    const loading = loadRemote('carrinho')
    await vi.waitFor(() => expect(net.fetch).toHaveBeenCalled())
    net.release()
    await loading
    expect(JSON.parse(localStorage[KEY]).m.entry).toBe('https://outro.com/velho.js')
  })

  it('cópia salva corrompida vale como sem cópia', async () => {
    localStorage[KEY] = '{'
    const net = network()
    setup(60)
    const loading = loadRemote('carrinho')
    await vi.waitFor(() => expect(net.fetch).toHaveBeenCalled())
    net.release()
    await loading
    expect(JSON.parse(localStorage[KEY]).m.version).toBe('2')
  })
})

describe('keys', () => {
  it('o manifesto é pedido com as assinaturas no integrity, e os hashes ganham as chaves', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ name: 'carrinho', entry: 'remote.js', integrity: 'sha384-A', files: { 'remote.css': 'sha384-B' } })))
    vi.stubGlobal('fetch', fetch)
    configure({ allowedOrigins: ['*'], retries: 0 })
    const { resolveEntry } = await import('../src/core/loader')
    const r = await resolveEntry('carrinho', { url: URL_M, keys: ['K1', 'K2'] })
    expect((fetch.mock.calls[0] as unknown[])[1]).toMatchObject({ integrity: 'ed25519-K1 ed25519-K2' })
    expect(r.integrity).toBe('sha384-A ed25519-K1 ed25519-K2')
    expect(r.sri!['https://cdn.empresa.com/carrinho/remote.css']).toBe('sha384-B ed25519-K1 ed25519-K2')
  })
})
