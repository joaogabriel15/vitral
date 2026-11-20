// @vitest-environment happy-dom
// Deploy novo com a aba aberta: arquivos antigos sumiram.
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { configure, mountRemote, register, type RemoteContext } from '../src/index'
import { cleanup } from './helpers'

afterEach(cleanup)

const V2 = pathToFileURL(resolve(__dirname, 'fixtures/remote-v2.mjs')).href
const GONE = pathToFileURL(resolve(__dirname, 'fixtures/nao-existe-mais.mjs')).href

/** `vitral.json` que muda de `first` para `then` depois do primeiro pedido. */
function deploy(first: string, then: string) {
  let n = 0
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ name: 'conta', entry: n++ ? then : first })))
  vi.stubGlobal('fetch', fetch)
  configure({ allowedOrigins: ['*'], retries: 0 })
  register('conta', { url: 'https://cdn.test/conta/vitral.json' })
  return fetch
}

describe('manifesto velho', () => {
  it('JS do manifesto sumiu: relê o vitral.json sem cache e monta a versão nova', async () => {
    const fetch = deploy(GONE, V2)
    const el = document.body.appendChild(document.createElement('div'))
    await mountRemote(el, 'conta', {})
    expect(el.textContent).toBe('v2 conta')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][1]?.cache).toBe('reload')
  })

  it('o manifesto novo aponta para o mesmo arquivo: o erro original sobe', async () => {
    deploy(GONE, GONE)
    await expect(mountRemote(document.body, 'conta', {})).rejects.toMatchObject({ code: 'LOAD_FAILED' })
  })
})

describe('chunk sumido num remote montado', () => {
  const CTX = pathToFileURL(resolve(__dirname, 'fixtures/remote-ctx.mjs')).href
  const setup = (next: string) => {
    let n = 0
    const fetch = vi.fn(async () => new Response(JSON.stringify({ name: 'loja', entry: n++ ? next : CTX })))
    vi.stubGlobal('fetch', fetch)
    configure({ allowedOrigins: ['*'] })
    register('loja', { url: 'https://cdn.test/loja/vitral.json' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    return { fetch, warn: vi.spyOn(console, 'warn').mockImplementation(() => {}) }
  }
  const ctx = () => (globalThis as any).__ctx as RemoteContext

  it('erro de import() dinâmico troca pela versão nova', async () => {
    const { warn } = setup(V2)
    const el = document.body.appendChild(document.createElement('div'))
    await mountRemote(el, 'loja', {})
    expect(el.textContent).toBe('v1 loja')
    ctx().reportError(new TypeError('Failed to fetch dynamically imported module: https://cdn.test/loja/rota-abc.js'))
    await vi.waitFor(() => expect(el.textContent).toBe('v2 loja'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('deploy novo'))
  })

  it('outro erro, ou manifesto sem versão nova: nada muda', async () => {
    const { fetch } = setup(CTX)
    const el = document.body.appendChild(document.createElement('div'))
    await mountRemote(el, 'loja', {})
    ctx().reportError(new Error('qualquer'))
    await new Promise((r) => setTimeout(r, 20))
    expect(fetch).toHaveBeenCalledTimes(1)
    ctx().reportError(new TypeError('Importing a module script failed.'))
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(el.textContent).toBe('v1 loja')
  })
})
