// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { empty, LIMITS, parse, predict, record, remember } from '../src/core/markov'
import { prefetch } from '../src/prefetch'
import { configure } from '../src/index'
import { cleanup, flush } from './helpers'

describe('cadeia de Markov', () => {
  it('conta transições e prevê a rota mais provável', () => {
    const c = empty()
    record(c, '/a', '/b')
    record(c, '/a', '/b')
    record(c, '/a', '/c')
    expect(c.t['/a']).toEqual({ '/b': 2, '/c': 1 })
    expect(predict(c, '/a', 0.5)).toBe('/b')
    expect(predict(c, '/a', 0.7)).toBeNull()
    expect(predict(c, '/a', 0.5, 4)).toBeNull()
    expect(predict(c, '/x', 0)).toBeNull()
  })

  it('ignora a mesma rota, chaves longas e __proto__', () => {
    const c = empty()
    record(c, '/a', '/a')
    record(c, '__proto__', '/a')
    record(c, '/a', '__proto__')
    record(c, '/a', '/' + 'x'.repeat(LIMITS.key))
    expect(remember(c, '__proto__', 'r')).toBe(false)
    expect(c).toEqual(empty())
    expect(({} as any)['/a']).toBeUndefined()
    expect(predict(c, 'toString', 0)).toBeNull()
  })

  it('rota muito visitada: divide as contagens ao passar do limite', () => {
    const c = empty()
    c.t['/a'] = { '/b': LIMITS.total, '/c': 1 }
    record(c, '/a', '/b')
    expect(c.t['/a']).toEqual({ '/b': (LIMITS.total + 1) >> 1 })
  })

  it('limita destinos por rota e rotas guardadas, tirando as menos vistas', () => {
    const c = empty()
    for (let i = 0; i < LIMITS.next; i++) for (let n = 0; n <= i; n++) record(c, '/a', `/d${i}`)
    record(c, '/a', '/novo')
    expect(Object.keys(c.t['/a'])).toHaveLength(LIMITS.next)
    expect(c.t['/a']['/novo']).toBe(1)
    expect(c.t['/a']['/d0']).toBeUndefined()
    for (let i = 0; i < LIMITS.routes; i++) record(c, `/r${i}`, '/a')
    expect(Object.keys(c.t)).toHaveLength(LIMITS.routes)
    expect(c.t['/a']).toBeDefined()
  })

  it('guarda os remotes de cada rota, sem repetir e dentro do limite', () => {
    const c = empty()
    expect(remember(c, '/a', 'x')).toBe(true)
    expect(remember(c, '/a', 'x')).toBe(false)
    for (let i = 0; i < LIMITS.remotes; i++) remember(c, '/a', `r${i}`)
    expect(c.r['/a']).toHaveLength(LIMITS.remotes)
    expect(c.r['/a']).not.toContain('x')
    for (let i = 0; i < LIMITS.routes; i++) remember(c, `/r${i}`, 'y')
    expect(Object.keys(c.r)).toHaveLength(LIMITS.routes)
    expect(c.r[`/r${LIMITS.routes - 1}`]).toEqual(['y'])
  })

  it('JSON fora do formato vira cadeia vazia', () => {
    expect(parse(null)).toEqual(empty())
    expect(parse('{')).toEqual(empty())
    expect(parse('{"t":{"/a":{"/b":"x"}},"r":{}}')).toEqual(empty())
    expect(parse('{"t":{},"r":{"/a":[1]}}')).toEqual(empty())
    expect(parse('{"t":{"/a":{"/b":2}},"r":{"/b":["b"]}}')).toEqual({ t: { '/a': { '/b': 2 } }, r: { '/b': ['b'] } })
  })
})

const CDN = 'https://cdn.empresa.com/'
let links: MutationObserver

/** Manifestos e arquivos do CDN; os modulepreload sempre carregam. */
function cdn(manifests: Record<string, object>) {
  const fetch = vi.fn(async (url: string) => {
    const m = manifests[url]
    return m ? new Response(JSON.stringify(m)) : new Response('/* js */')
  })
  vi.stubGlobal('fetch', fetch)
  links = new MutationObserver((rs) => {
    for (const r of rs) for (const n of r.addedNodes) if (n instanceof HTMLLinkElement && n.rel === 'modulepreload') n.dispatchEvent(new Event(n.href.includes('falha') ? 'error' : 'load'))
  })
  links.observe(document.head, { childList: true })
  return fetch
}

const go = (path: string) => {
  history.pushState(null, '', path)
  dispatchEvent(new PopStateEvent('popstate'))
}
const mount = (name: string) => performance.measure(`vitral:${name}:mount`, { start: 0 })
/** Mais que o atraso do fallback de requestIdleCallback. */
const idle = () => new Promise((r) => setTimeout(r, 350))
const urls = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map(([u]) => u)

beforeEach(() => {
  history.replaceState(null, '', '/a')
  performance.clearMeasures()
})

afterEach(() => {
  links?.disconnect()
  document.head.replaceChildren()
  vi.restoreAllMocks()
  cleanup()
})

/** Treina A → B `n` vezes, com o remote `b` montado em /b. */
async function train(n: number) {
  const stop = prefetch()
  for (let i = 0; i < n; i++) {
    go('/b')
    mount('b')
    await flush()
    go('/a')
    await flush()
  }
  stop()
  // As montagens do treino foram em outra página.
  performance.clearMeasures()
}

describe('prefetch()', () => {
  it('aprende as transições e os remotes de cada rota, no localStorage', async () => {
    await train(2)
    const c = JSON.parse(localStorage.getItem('vitral:prefetch')!)
    expect(c.t).toEqual({ '/a': { '/b': 2 }, '/b': { '/a': 2 } })
    expect(c.r).toEqual({ '/b': ['b'] })
  })

  it('na rota A, baixa no tempo ocioso o manifesto e o JS do remote de B, sem executar', async () => {
    await train(2)
    const fetch = cdn({ [CDN + 'b/vitral.json']: { name: 'b', entry: 'remote.js' } })
    configure({ remotes: { b: CDN + 'b/vitral.json' } })
    const onPrefetch = vi.fn()
    const stop = prefetch({ onPrefetch })
    await vi.waitFor(() => expect(onPrefetch).toHaveBeenCalledWith(['b'], '/b'))
    expect(urls(fetch)).toEqual([CDN + 'b/vitral.json'])
    const link = document.head.querySelector<HTMLLinkElement>('link[rel="modulepreload"]')!
    expect(link.href).toBe(CDN + 'b/remote.js')
    expect(link.fetchPriority).toBe('low')
    // Uma vez só por página.
    go('/c')
    go('/a')
    await idle()
    expect(onPrefetch).toHaveBeenCalledTimes(1)
    stop()
  })

  it('abaixo do limiar ou com poucas transições, não baixa nada', async () => {
    await train(1)
    const fetch = cdn({})
    configure({ remotes: { b: CDN + 'b/vitral.json' } })
    const stop = prefetch()
    await idle()
    expect(fetch).not.toHaveBeenCalled()
    stop()
    await train(1)
    const again = prefetch({ threshold: 1.1 })
    await idle()
    expect(fetch).not.toHaveBeenCalled()
    again()
  })

  it('pula remote já montado na página', async () => {
    await train(2)
    const fetch = cdn({})
    configure({ remotes: { b: CDN + 'b/vitral.json' } })
    mount('b')
    const stop = prefetch()
    await idle()
    expect(fetch).not.toHaveBeenCalled()
    stop()
  })

  it('respeita economia de dados e 2G', async () => {
    await train(2)
    const fetch = cdn({})
    configure({ remotes: { b: CDN + 'b/vitral.json' } })
    for (const connection of [{ saveData: true }, { effectiveType: 'slow-2g' }]) {
      vi.stubGlobal('navigator', { ...navigator, connection })
      const stop = prefetch()
      await idle()
      stop()
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it('usa requestIdleCallback e a Navigation API quando existem', async () => {
    const idle = vi.fn((fn: () => void) => setTimeout(fn, 0))
    vi.stubGlobal('requestIdleCallback', idle)
    const nav = new EventTarget()
    vi.stubGlobal('navigation', nav)
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() }
    const stop = prefetch({ storage, key: (u) => u.pathname + u.search })
    history.pushState(null, '', '/a?x=1')
    nav.dispatchEvent(new Event('currententrychange'))
    expect(JSON.parse(storage.setItem.mock.calls[0][1] as string).t).toEqual({ '/a': { '/a?x=1': 1 } })
    expect(idle).toHaveBeenCalled()
    stop()
  })

  it('storage que falha ou `null`: funciona só na memória', async () => {
    const broken = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('cheio')
      },
    }
    const a = prefetch({ storage: broken })
    go('/b')
    a()
    const b = prefetch({ storage: null })
    go('/a')
    b()
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('negado')
    })
    const c = prefetch()
    go('/b')
    c()
  })

  it('fora do navegador não faz nada', () => {
    vi.stubGlobal('window', undefined)
    expect(prefetch()).toBeTypeOf('function')
  })
})

describe('warm()', () => {
  // O estado do SRI (caminho escolhido) é por módulo: um novo a cada teste.
  let warm: typeof import('../src/prefetch').warm
  beforeEach(async () => {
    vi.resetModules()
    ;({ warm } = await import('../src/prefetch'))
  })

  it('remote com integrity sem caminho do navegador: só fetch, sem modulepreload', async () => {
    const sha = 'sha384-' + 'A'.repeat(64)
    const fetch = cdn({ [CDN + 'b/vitral.json']: { name: 'b', entry: 'remote.js', integrity: sha, css: ['b.css'] } })
    vi.spyOn(HTMLScriptElement, 'supports').mockReturnValue(false)
    vi.spyOn(HTMLLinkElement.prototype, 'relList', 'get').mockReturnValue({ supports: () => false } as any)
    configure({ remotes: { b: CDN + 'b/vitral.json' } })
    expect(await warm('b/Mini')).toBe(true)
    expect(urls(fetch).sort()).toEqual([CDN + 'b/b.css', CDN + 'b/remote.js', CDN + 'b/vitral.json'])
    // Mesmo modo de credenciais do fetchBytes da montagem: o WebKit só reaproveita o cache assim.
    expect(fetch).toHaveBeenCalledWith(CDN + 'b/remote.js', { priority: 'low', credentials: 'omit' })
    expect(fetch).toHaveBeenCalledWith(CDN + 'b/b.css', { priority: 'low', credentials: undefined })
    expect(document.head.querySelector('link[rel="modulepreload"]')).toBeNull()
  })

  it('remote com integrity onde o modulepreload confere o hash: modulepreload com integrity', async () => {
    const sha = 'sha384-' + 'A'.repeat(64)
    const fetch = cdn({ [CDN + 'b/vitral.json']: { name: 'b', entry: 'remote.js', integrity: sha } })
    vi.spyOn(HTMLScriptElement, 'supports').mockReturnValue(false)
    vi.spyOn(HTMLLinkElement.prototype, 'relList', 'get').mockReturnValue({ supports: (r: string) => r === 'modulepreload' } as any)
    // O teste do caminho 2: o módulo `data:` com hash errado falha.
    links.disconnect()
    links = new MutationObserver((rs) => {
      for (const r of rs)
        for (const n of r.addedNodes)
          if (n instanceof HTMLLinkElement) n.dispatchEvent(new Event(n.href.startsWith('data:') && !n.href.endsWith('export{}') ? 'error' : 'load'))
    })
    links.observe(document.head, { childList: true })
    configure({ remotes: { b: CDN + 'b/vitral.json' } })
    expect(await warm('b')).toBe(true)
    const link = document.head.querySelector<HTMLLinkElement>(`link[rel="modulepreload"][href="${CDN}b/remote.js"]`)!
    expect(link.integrity).toBe(sha)
    // A entrada já está no mapa de módulos: sem fetch a mais.
    expect(urls(fetch)).toEqual([CDN + 'b/vitral.json'])
  })

  it('iframe, remote local, sem registro ou falha: false, sem erro', async () => {
    cdn({})
    const error = vi.spyOn(console, 'error')
    configure({ remotes: { f: { url: CDN + 'f.js', isolate: 'iframe' }, l: { module: {} }, falha: CDN + 'falha.js' } })
    expect(await warm('f')).toBe(false)
    expect(await warm('l')).toBe(false)
    expect(await warm('nada')).toBe(false)
    expect(await warm('falha')).toBe(false)
    expect(error).not.toHaveBeenCalled()
  })
})
