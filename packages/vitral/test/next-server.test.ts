import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('vitral-next-host-config', () => ({
  remotes: {
    loja: { url: '/loja-remote/vitral.json', basePath: '/loja' },
    fora: { url: 'https://cdn.x/fora/vitral.json', basePath: '/fora' },
  },
  shared: {},
}))

import { clearRemoteCache, remoteManifest, remoteProps } from '../src/next-server'

const manifest = (v: string) => ({ name: 'loja', entry: `remote-${v}.js`, version: v })
afterEach(() => {
  clearRemoteCache()
  vi.useRealTimers()
})

describe('vitral/next-server', () => {
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
})
