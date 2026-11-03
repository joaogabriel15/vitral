// @vitest-environment happy-dom
// O manifesto baixa enquanto as ofertas de dedupe do host ainda se registram.
import { afterEach, describe, expect, it } from 'vitest'
import { configure, loadRemote, register } from '../src/index'
import { protocol } from '../src/core/state'
import { cleanup, flush, serveManifest } from './helpers'

afterEach(cleanup)

describe('manifesto antes das ofertas', () => {
  it('o fetch do manifesto não espera o pending; o import espera', async () => {
    const fetch = serveManifest('cedo')
    let release!: () => void
    protocol().pending(new Promise<void>((r) => (release = r)))
    register('cedo', 'https://cdn.x/cedo/vitral.json')
    const loading = loadRemote('cedo')
    await flush()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe('https://cdn.x/cedo/vitral.json')
    release()
    expect(typeof (await loading).mount).toBe('function')
    // O mesmo pedido: nenhum segundo download do manifesto.
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('origem não permitida e remote local: nada de fetch antes', async () => {
    const fetch = serveManifest('x')
    configure({ allowedOrigins: ['https://ok.x'] })
    let release!: () => void
    protocol().pending(new Promise<void>((r) => (release = r)))
    register('fora', 'https://cdn.x/fora/vitral.json')
    register('local', { module: { mount: () => ({ unmount() {} }) } })
    const a = loadRemote('fora').catch((e) => e.code)
    const b = loadRemote('local')
    await flush()
    expect(fetch).not.toHaveBeenCalled()
    release()
    expect(await a).toBe('ORIGIN_BLOCKED')
    expect(typeof (await b).mount).toBe('function')
  })
})
