import { afterEach, describe, expect, it, vi } from 'vitest'

const k = vi.hoisted(() => {
  const { generateKeyPairSync } = require('node:crypto')
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  return { privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }) as string, publicKey: Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url').toString('base64') }
})

vi.mock('vitral-next-host-config', () => ({
  remotes: {
    loja: { url: '/loja-remote/vitral.json', basePath: '/loja' },
    assinado: { url: 'https://cdn.x/assinado/vitral.json', basePath: '/assinado', keys: [k.publicKey] },
    fora: { url: 'https://cdn.x/fora/vitral.json', basePath: '/fora' },
  },
  shared: {},
}))

import { clearRemoteCache, remoteManifest, remoteProps } from '../src/next-server'
import { keygen, signBody } from '../src/sign'

const manifest = (v: string) => ({ name: 'loja', entry: `remote-${v}.js`, version: v })
afterEach(() => {
  clearRemoteCache()
  vi.useRealTimers()
})

describe('vitral/next-server', () => {
  it('com keys, só aceita o manifesto assinado por uma delas', async () => {
    const body = JSON.stringify(manifest('1'))
    const bytes = new TextEncoder().encode(body)
    const ok = vi.fn(async () => new Response(body, { headers: signBody(bytes, k.privateKey) }))
    expect(await remoteManifest('assinado', { fetch: ok })).toEqual(manifest('1'))
    clearRemoteCache()
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const outra = vi.fn(async () => new Response(body, { headers: signBody(bytes, keygen().privateKey) }))
    expect(await remoteManifest('assinado', { fetch: outra })).toBeNull()
    clearRemoteCache()
    expect(await remoteManifest('assinado', { fetch: vi.fn(async () => new Response(body)) })).toBeNull()
    expect(err).toHaveBeenCalledWith(expect.stringContaining('assinatura do manifesto'))
    err.mockRestore()
  })

  it('URL relativa: a origem da opção (nunca o Host da requisição); props por nome', async () => {
    const f = vi.fn(async () => Response.json(manifest('1')))
    expect(await remoteProps('loja', { origin: 'http://interno:3000', fetch: f })).toEqual({ vitral: { loja: manifest('1') } })
    expect(f.mock.calls[0][0]).toBe('http://interno:3000/loja-remote/vitral.json')
    await remoteProps(['fora'], { fetch: f })
    expect(f.mock.calls[1][0]).toBe('https://cdn.x/fora/vitral.json')
  })

  it('cache: fresco sem pedir, velho responde e renova por trás, vencido espera o novo', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    let v = 1
    const f = vi.fn(async () => Response.json(manifest(String(v))))
    const o = { origin: 'http://h', fetch: f, maxAge: 5, staleWhileRevalidate: 30 }
    expect((await remoteManifest('loja', o))!.version).toBe('1')
    vi.setSystemTime(Date.now() + 3000)
    v = 2
    expect((await remoteManifest('loja', o))!.version).toBe('1')
    expect(f).toHaveBeenCalledTimes(1)
    // Velho: responde o guardado e renova.
    vi.setSystemTime(Date.now() + 10_000)
    expect((await remoteManifest('loja', o))!.version).toBe('1')
    await vi.waitFor(async () => expect((await remoteManifest('loja', o))!.version).toBe('2'))
    expect(f).toHaveBeenCalledTimes(2)
    // Vencido: espera o pedido novo.
    vi.setSystemTime(Date.now() + 60_000)
    v = 3
    expect((await remoteManifest('loja', o))!.version).toBe('3')
  })

  it('falha, canal ou remote desconhecido', async () => {
    const o = { origin: 'http://h' }
    expect(await remoteManifest('loja', { ...o, fetch: async () => new Response('x', { status: 502 }) })).toBeNull()
    clearRemoteCache()
    expect(await remoteManifest('loja', { ...o, fetch: async () => Response.json({ stable: '/a/vitral.json' }) })).toBeNull()
    clearRemoteCache()
    // Uma falha depois de um manifesto bom mantém o bom.
    vi.useFakeTimers({ toFake: ['Date'] })
    await remoteManifest('loja', { ...o, fetch: async () => Response.json(manifest('1')) })
    vi.setSystemTime(Date.now() + 120_000)
    expect((await remoteManifest('loja', { ...o, fetch: async () => { throw new Error('rede') } }))!.version).toBe('1')
    await expect(remoteManifest('nada', o)).rejects.toThrow(/withVitral/)
  })

  it('ssr: HTML do remote com escopo, CSS com hash e estado; erro ou demora dá null', async () => {
    const m = { ...manifest('1'), scope: 'loja', css: ['loja.css'], files: { 'loja.css': 'sha384-c' } }
    const f = async () => Response.json(m)
    const render = vi.fn(async (p: Record<string, unknown>) => ({ html: `<p>${p.id}</p>`, state: { id: p.id } }))
    const out = await remoteProps(['loja', 'fora'], { origin: 'http://h', fetch: f, ssr: { loja: { render, props: { id: 3 } } } })
    expect(render).toHaveBeenCalledWith({ id: 3 })
    expect(out.vitralSsr).toEqual({
      loja:
        '<div data-vitral-ssr data-vitral-slot="loja"><script type="application/json" data-vitral-state>{"id":3}</script>' +
        '<link rel="stylesheet" href="/loja-remote/loja.css" crossorigin="anonymous" integrity="sha384-c">' +
        '<div data-vitral-root="loja" data-vitral-scope="loja" style="display:contents"><p>3</p></div></div>',
      fora: null,
    })
    clearRemoteCache()
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const bad = await remoteProps('loja', { origin: 'http://h', fetch: f, ssr: { loja: { render: () => { throw new Error('x') } } } })
    expect(bad.vitralSsr).toEqual({ loja: null })
    const slow = await remoteProps('loja', { origin: 'http://h', fetch: f, timeout: 20, ssr: { loja: { render: () => new Promise<string>(() => {}) } } })
    expect(slow.vitralSsr).toEqual({ loja: null })
    expect(err).toHaveBeenCalledTimes(2)
    err.mockRestore()
  })
})
