import { afterEach, describe, expect, it, vi } from 'vitest'
import { filesOf, remoteWorker } from '../src/sw'

/** CacheStorage em memória, com um único cache. */
function fakeCaches() {
  const store = new Map<string, Response>()
  const key = (r: RequestInfo | URL) => (typeof r === 'string' ? r : r instanceof URL ? r.href : r.url)
  const cache = {
    match: async (r: RequestInfo | URL) => store.get(key(r))?.clone(),
    put: async (r: RequestInfo | URL, res: Response) => void store.set(key(r), res),
    add: async (r: RequestInfo | URL) => {
      const res = await fetch(key(r))
      if (!res.ok) throw new Error('add')
      store.set(key(r), res)
    },
    keys: async () => [...store.keys()].map((url) => ({ url })),
    delete: async (r: { url: string }) => store.delete(r.url),
  }
  return { store, caches: { open: async () => cache } }
}

const H = 'https://host.test'
const manifest = (v: string) => ({
  name: 'loja',
  entry: `remote-${v}.js`,
  css: [`style-${v}.css`],
  split: { entry: `split/entry-${v}.js`, chunks: [`split/c-${v}.js`] },
})

function setup(served: Record<string, unknown>) {
  const { store, caches } = fakeCaches()
  const net = vi.fn(async (u: RequestInfo | URL) => {
    const url = typeof u === 'string' ? u : u instanceof URL ? u.href : u.url
    const body = served[url]
    if (body === undefined) return new Response('', { status: 404 })
    return typeof body === 'string' ? new Response(body) : Response.json(body)
  })
  vi.stubGlobal('caches', caches)
  vi.stubGlobal('fetch', net)
  const on: Record<string, (e: any) => void> = {}
  remoteWorker({ addEventListener: (t, fn) => (on[t] = fn), location: { href: `${H}/sw.js` } }, { manifests: ['/loja-remote/vitral.json'] })
  /** Dispara um evento e espera tudo que ele pediu. */
  const fire = async (type: string, extra: Record<string, unknown> = {}) => {
    const waits: Promise<unknown>[] = []
    let res: Promise<Response> | undefined
    on[type]({ waitUntil: (p: Promise<unknown>) => waits.push(p), respondWith: (p: Promise<Response>) => (res = p), ...extra })
    const out = res && (await res)
    await Promise.all(waits)
    await Promise.all(waits)
    return out
  }
  return { store, net, fire, served }
}

const R = `${H}/loja-remote/`
const files1 = [`${R}style-1.css`, `${R}split/entry-1.js`, `${R}split/c-1.js`]
afterEach(() => vi.unstubAllGlobals())

describe('remoteWorker', () => {
  it('filesOf lista o manifesto e o que ele aponta', () => {
    expect(filesOf(manifest('1') as never, `${R}vitral.json`)).toEqual([`${R}vitral.json`, ...files1])
  })

  it('filesOf: sem a cópia própria dos grupos que o host oferece; o arquivo único só com `single`', () => {
    const m = {
      ...manifest('1'),
      files: { 'remote-1.js': 'h', 'remote-vendor.js': 'h', 'split/entry-1.js': 'h', 'split/ui.js': 'h', 'split/react.js': 'h', 'split/comum.js': 'h' },
      split: { entry: 'split/entry-1.js', chunks: ['split/c-1.js', 'split/comum.js'], lazy: ['split/rota.js'] },
      dedupe: [
        { name: 'react', range: '^19.0.0', version: '19.1.0', file: 'split/react.js' },
        { name: '@acme/ui', range: '^1.2.0', version: '1.2.3', file: 'split/ui.js', chunks: ['split/comum.js'] },
      ],
    }
    const list = (o?: object) => filesOf(m as never, `${R}vitral.json`, o).map((u) => u.slice(R.length))
    expect(list({ offered: { '@acme/ui': '1.4.0', react: '18.3.1' } })).toEqual(['vitral.json', 'style-1.css', 'split/entry-1.js', 'split/react.js', 'split/comum.js', 'split/c-1.js', 'split/rota.js'])
    expect(list({ single: true })).toContain('remote-vendor.js')
    expect(list()).not.toContain('remote-1.js')
  })

  it('install: guarda manifesto e arquivos, e registra a rota estática do split', async () => {
    const served = { [`${R}vitral.json`]: manifest('1'), ...Object.fromEntries(files1.map((f) => [f, 'x'])) }
    const { store, fire } = setup(served)
    const addRoutes = vi.fn()
    await fire('install', { addRoutes })
    expect([...store.keys()].sort()).toEqual([`${R}vitral.json`, ...files1].sort())
    expect(addRoutes).toHaveBeenCalledWith([{ condition: { urlPattern: `${R}split/*` }, source: { cacheName: 'vitral-remotes' } }])
    // Sem Static Routing API (ou com erro), o install segue.
    await fire('install', { addRoutes: () => { throw new Error('não') } })
  })

  it('fetch: arquivo com hash sai do cache; manifesto vai à rede e traz a versão nova', async () => {
    const served: Record<string, unknown> = { [`${R}vitral.json`]: manifest('1'), ...Object.fromEntries(files1.map((f) => [f, 'v1'])) }
    const { store, net, fire } = setup(served)
    await fire('install')
    net.mockClear()
    const hit = await fire('fetch', { request: new Request(`${R}split/entry-1.js`) })
    expect(await hit!.text()).toBe('v1')
    expect(net).not.toHaveBeenCalled()
    // Fora do remote: o worker não responde.
    expect(await fire('fetch', { request: new Request(`${H}/app.js`) })).toBeUndefined()

    // Deploy novo do remote.
    served[`${R}vitral.json`] = manifest('2')
    for (const f of files1) served[f.replace('-1.', '-2.')] = 'v2'
    const m = await fire('fetch', { request: new Request(`${R}vitral.json`) })
    expect((await m!.json()).entry).toBe('remote-2.js')
    const keys = [...store.keys()]
    expect(keys).toContain(`${R}split/entry-2.js`)
    expect(keys).toContain(`${R}split/c-2.js`)
    // A versão antiga saiu do cache.
    expect(keys.filter((k) => k.includes('-1.'))).toEqual([])
  })

  it('offline: o manifesto sai do cache; manifesto que não chega não apaga nada', async () => {
    const served: Record<string, unknown> = { [`${R}vitral.json`]: manifest('1'), ...Object.fromEntries(files1.map((f) => [f, 'v1'])) }
    const { store, net, fire } = setup(served)
    await fire('install')
    net.mockImplementation(async () => {
      throw new TypeError('offline')
    })
    const m = await fire('fetch', { request: new Request(`${R}vitral.json`) })
    expect((await m!.json()).entry).toBe('remote-1.js')
    await fire('activate')
    expect(store.size).toBe(4)
  })
})
