// @vitest-environment happy-dom
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkUpdates, configure, loadRemote, mountRemote, RemoteError, type Channel, type RemoteContext, type RemoteEntry } from '../src/index'
import { bucket, resetChannels, versionUrl } from '../src/core/channel'
import { cleanup, flush } from './helpers'

const CANAL = 'https://cdn.exemplo.com/checkout/canal.json'
const THROWS = pathToFileURL(resolve(__dirname, 'fixtures/remote-throws.mjs')).href

/** Arquivo de cada versão: o remote mostra a própria versão e guarda o ctx de cada montagem. */
const versionFile = (v: string) => pathToFileURL(resolve(__dirname, `fixtures/canal/${v}.mjs`)).href

/** Versões publicadas: `vitral.json` de cada pasta. As de `quebradas` têm um mount que lança. */
function serve(channel: Channel, quebradas: string[] = []) {
  const fetch = vi.fn(async (url: string) => {
    if (url === CANAL) return new Response(JSON.stringify(channel))
    const v = url.match(/checkout\/([^/]+)\/vitral\.json$/)?.[1]
    if (!v) return new Response('não achei', { status: 404 })
    return new Response(JSON.stringify({ name: 'checkout', version: v, entry: quebradas.includes(v) ? THROWS : versionFile(v) }))
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

const fetched = (fetch: ReturnType<typeof vi.fn>) => fetch.mock.calls.map(([u]) => String(u).replace('https://cdn.exemplo.com/checkout/', ''))
const box = () => document.body.appendChild(document.createElement('div'))
const ctxs = () => ((globalThis as any).__vitralCtx ??= []) as RemoteContext[]
const quiet = () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
}

function setup(entry: Omit<RemoteEntry, 'url'> = {}, onRollback = vi.fn()) {
  configure({ allowedOrigins: ['*'], retries: 0, onRollback, remotes: { checkout: { url: CANAL, ...entry } } })
  return onRollback
}

beforeEach(() => {
  ctxs().length = 0
  sessionStorage.clear()
  resetChannels()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('canal', () => {
  it('percent 100 baixa a canary; percent 0, a estável', async () => {
    const fetch = serve({ stable: '1.4.0', canary: { version: '1.5.0', percent: 100 } })
    setup()
    const el = box()
    await mountRemote(el, 'checkout', {})
    expect(el.textContent).toBe('1.5.0')
    expect(fetched(fetch)).toEqual(['canal.json', '1.5.0/vitral.json'])

    cleanup()
    serve({ stable: '1.4.0', canary: { version: '1.5.0', percent: 0 } })
    setup()
    const outro = box()
    await mountRemote(outro, 'checkout', {})
    expect(outro.textContent).toBe('1.4.0')
  })

  it('sem canary, todos recebem a estável', async () => {
    serve({ stable: '1.4.0' })
    setup()
    const el = box()
    await mountRemote(el, 'checkout', {})
    expect(el.textContent).toBe('1.4.0')
  })

  it('a versão pode ser caminho ou URL de um vitral.json', () => {
    expect(versionUrl('1.5.0', CANAL)).toBe('https://cdn.exemplo.com/checkout/1.5.0/vitral.json')
    expect(versionUrl('./v/7/vitral.json', CANAL)).toBe('https://cdn.exemplo.com/checkout/v/7/vitral.json')
    expect(versionUrl('https://outro.cdn/x/vitral.json', CANAL)).toBe('https://outro.cdn/x/vitral.json')
  })

  it('canal sem "stable" válido é INVALID_MODULE', async () => {
    serve({ stable: 1 as unknown as string })
    setup()
    const e = (await loadRemote('checkout').catch((e) => e)) as RemoteError
    expect(e.code).toBe('INVALID_MODULE')
    expect(e.message).toContain('canal inválido')
  })

  it('o sorteio é estável por canaryKey e por remote', () => {
    configure({ canaryKey: 'usuario-42' })
    const b = bucket('checkout')
    expect(b).toBeGreaterThanOrEqual(0)
    expect(b).toBeLessThan(100)
    expect(bucket('checkout')).toBe(b)
    // 10% dos usuários: perto de 100 em 1000 chaves.
    let canary = 0
    for (let i = 0; i < 1000; i++) {
      configure({ canaryKey: `u${i}` })
      if (bucket('checkout') < 10) canary++
    }
    expect(canary).toBeGreaterThan(60)
    expect(canary).toBeLessThan(140)
  })

  it('sem canaryKey, usa um id do navegador guardado no localStorage', () => {
    const b = bucket('checkout')
    const id = localStorage.getItem('vitral:id')
    expect(id).toBeTruthy()
    resetChannels()
    expect(bucket('checkout')).toBe(b)
    expect(localStorage.getItem('vitral:id')).toBe(id)
  })

  it('sem localStorage, o id fica na memória', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(bucket('checkout')).toBe(bucket('checkout'))
  })

  it('resolve escolhe a versão com o canal e o bucket; undefined cai na regra padrão', async () => {
    const fetch = serve({ stable: '1.4.0', canary: { version: '1.5.0', percent: 0 }, beta: '1.6.0' })
    const resolve = vi.fn((c: Channel) => (document.cookie.includes('beta=1') ? (c.beta as string) : undefined))
    setup({ resolve })
    const el = box()
    await mountRemote(el, 'checkout', {})
    expect(el.textContent).toBe('1.4.0')
    expect(resolve.mock.calls[0][1]).toEqual({ name: 'checkout', bucket: expect.any(Number) })

    cleanup()
    document.cookie = 'beta=1'
    serve({ stable: '1.4.0', beta: '1.6.0' })
    setup({ resolve: (c) => c.beta as string })
    const outro = box()
    await mountRemote(outro, 'checkout', {})
    expect(outro.textContent).toBe('1.6.0')
    document.cookie = 'beta=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    expect(fetch).toHaveBeenCalled()
  })
})

describe('rollback automático', () => {
  it('N erros de montagem na canary voltam para a estável na sessão e chamam onRollback', async () => {
    quiet()
    const errors: RemoteError[] = []
    serve({ stable: '1.4.0', canary: { version: '1.5.0', percent: 100 } }, ['1.5.0'])
    const onRollback = setup({ rollback: { errors: 2 } })
    configure({ onError: (e) => errors.push(e) })
    for (let i = 0; i < 2; i++) await mountRemote(box(), 'checkout', {}).catch(() => {})
    expect(errors.map((e) => [e.code, e.version])).toEqual([
      ['MOUNT_FAILED', '1.5.0'],
      ['MOUNT_FAILED', '1.5.0'],
    ])
    expect(onRollback).toHaveBeenCalledWith({ name: 'checkout', from: '1.5.0', to: '1.4.0', errors: 2, mounts: 2 })
    expect(JSON.parse(sessionStorage.getItem('vitral:rollback')!)).toEqual({ checkout: '1.5.0' })

    const el = box()
    await mountRemote(el, 'checkout', {})
    expect(el.textContent).toBe('1.4.0')

    // Mesma sessão (nova carga da página): continua na estável.
    cleanup()
    resetChannels()
    sessionStorage.setItem('vitral:rollback', JSON.stringify({ checkout: '1.5.0' }))
    serve({ stable: '1.4.0', canary: { version: '1.5.0', percent: 100 } }, ['1.5.0'])
    setup()
    const depois = box()
    await mountRemote(depois, 'checkout', {})
    expect(depois.textContent).toBe('1.4.0')

    // Uma canary nova é tentada de novo.
    cleanup()
    serve({ stable: '1.4.0', canary: { version: '1.5.1', percent: 100 } })
    setup()
    const nova = box()
    await mountRemote(nova, 'checkout', {})
    expect(nova.textContent).toBe('1.5.1')
  })

  it('erros de render trocam a montagem na tela pela estável', async () => {
    quiet()
    serve({ stable: '1.4.0', canary: { version: '1.5.0', percent: 100 } })
    const onRollback = setup()
    const el = box()
    const handle = await mountRemote(el, 'checkout', {})
    expect(el.textContent).toBe('1.5.0')
    for (let i = 0; i < 3; i++) ctxs()[0].reportError(new Error('render'))
    expect(onRollback).toHaveBeenCalledTimes(1)
    await flush(20)
    expect(el.textContent).toBe('1.4.0')
    handle.unmount()
  })

  it('conta por janela de montagens: erros espalhados não disparam', async () => {
    quiet()
    serve({ stable: '1.4.0', canary: { version: '1.5.0', percent: 100 } })
    const onRollback = setup({ rollback: { errors: 2, mounts: 2 } })
    await mountRemote(box(), 'checkout', {})
    ctxs()[0].reportError(new Error('um'))
    await mountRemote(box(), 'checkout', {})
    await mountRemote(box(), 'checkout', {}) // terceira montagem: janela nova
    ctxs()[2].reportError(new Error('dois'))
    expect(onRollback).not.toHaveBeenCalled()
    ctxs()[2].reportError(new Error('três'))
    expect(onRollback).toHaveBeenCalledTimes(1)
  })

  it('rollback: false nunca volta', async () => {
    quiet()
    serve({ stable: '1.4.0', canary: { version: '1.5.0', percent: 100 } })
    const onRollback = setup({ rollback: false })
    const el = box()
    await mountRemote(el, 'checkout', {})
    for (let i = 0; i < 5; i++) ctxs()[0].reportError(new Error('render'))
    expect(onRollback).not.toHaveBeenCalled()
    expect(el.textContent).toBe('1.5.0')
  })

  it('erros de outros remotes e da estável não contam', async () => {
    quiet()
    serve({ stable: '1.4.0' })
    const onRollback = setup()
    configure({ remotes: { outro: { module: { mount: (_el: HTMLElement, _p: unknown, ctx: RemoteContext) => (ctxs().push(ctx), { unmount() {} }) } } } })
    await mountRemote(box(), 'checkout', {})
    await mountRemote(box(), 'outro', {})
    for (let i = 0; i < 5; i++) ctxs().forEach((c) => c.reportError(new Error('x')))
    expect(onRollback).not.toHaveBeenCalled()
  })
})

describe('canal e atualizações', () => {
  it('checkUpdates vê a mudança do canal (rollback manual)', async () => {
    const channel: Channel = { stable: '1.4.0', canary: { version: '1.5.0', percent: 100 } }
    serve(channel)
    setup()
    await mountRemote(box(), 'checkout', {})
    expect(await checkUpdates()).toEqual([])
    delete channel.canary
    expect(await checkUpdates()).toEqual(['checkout'])
  })
})
