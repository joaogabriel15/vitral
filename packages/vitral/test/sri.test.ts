// @vitest-environment happy-dom
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SplitBuild } from '../src/core/sri'

// O navegador de verdade é testado no e2e (e2e/sri.spec.ts). Aqui o happy-dom
// faz o papel do navegador: cada teste decide se o import map é aceito (e se
// o hash dele vale) e se o modulepreload confere o hash.

const CDN = 'https://cdn.empresa.com/carrinho/'
const sha = (s: string) => 'sha384-' + createHash('sha384').update(s).digest('base64')
const build: SplitBuild = {
  entry: CDN + 'split/entry.js',
  chunks: [CDN + 'split/a.js'],
  sri: { [CDN + 'split/entry.js']: sha('entry'), [CDN + 'split/a.js']: sha('a') },
}

let observer: MutationObserver | null = null
let blobs: ReturnType<typeof vi.spyOn>
/** Chamadas a `createObjectURL` do caminho 3, sem as dos módulos de teste. */
const remoteBlobs = () => blobs.mock.calls.filter(([b]: any) => b.size > 10)
/** `integrity` do primeiro import map, sem os módulos de teste. */
const mapped = () => {
  const all = JSON.parse(document.head.querySelector('script[type="importmap"]')!.textContent!).integrity
  return Object.fromEntries(Object.entries(all).filter(([, h]) => h !== PROBE_SRI))
}

/** Hash `sha256` dos módulos de teste do import map (o de `export{}`). */
const PROBE_SRI = 'sha256-d3bjIZdvLjBurwdLwkSVOnEBPFFly+T1SR9r3VVHBGg='
const data = (c: string) => `data:text/javascript,${encodeURIComponent(c)}`

/**
 * Simula o navegador. `map`: `ok` aceita o import map e confere o hash dele,
 * `silent` aceita sem conferir (ou recusa sem `error`, como o Safari 18.0–18.3),
 * `error` e `csp` recusam. `preload` decide o evento de cada modulepreload.
 * Os módulos de teste do import map (`blob:` de 8 e 10 bytes) viram `data:`;
 * o errado só falha com `ok`. Os outros `blob:` viram `blob` (caminho 3).
 */
function browser({ map, preload, blob }: { map: 'ok' | 'silent' | 'error' | 'csp'; preload?: (href: string, integrity: string) => boolean | null; blob?: string }) {
  const createObjectURL = URL.createObjectURL
  blobs = vi.spyOn(URL, 'createObjectURL').mockImplementation((b: any) => {
    if (b.size === 8) return data('export{}')
    if (b.size === 10) return map === 'ok' ? data('throw new Error("hash")') : data('export{}//')
    return blob ?? createObjectURL(b)
  })
  observer = new MutationObserver((records) => {
    for (const r of records) {
      for (const node of r.addedNodes) {
        if (node instanceof HTMLScriptElement && node.type === 'importmap' && (map === 'error' || map === 'csp')) {
          node.dispatchEvent(new Event(map === 'error' ? 'error' : 'securitypolicyviolation'))
        }
        if (node instanceof HTMLLinkElement && node.rel === 'modulepreload') {
          // null: o navegador nunca responde.
          const ok = preload ? preload(node.href, node.integrity) : true
          if (ok !== null) node.dispatchEvent(new Event(ok ? 'load' : 'error'))
        }
      }
    }
  })
  observer.observe(document.head, { childList: true })
  vi.spyOn(HTMLLinkElement.prototype, 'relList', 'get').mockReturnValue({ supports: (r: string) => r === 'modulepreload' } as any)
}

/** Navegador que confere o hash do modulepreload (Firefox, Chromium antigo). */
const checks = (href: string, integrity: string) => !href.startsWith('data:') || href.endsWith('export{}')
/** Navegador que ignora o integrity do modulepreload (WebKit). */
const ignores = () => true

const load = async () => {
  // O loader sempre cria o protocolo antes; aqui o teste chama verified() direto.
  ;(await import('../src/core/state')).protocol()
  return (await import('../src/core/sri')).verified
}

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('fetch', vi.fn(async () => new Response('')))
})

afterEach(() => {
  observer?.disconnect()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.head.replaceChildren()
  localStorage.clear()
})

describe('caminho 1: import map com integrity', () => {
  it('adiciona o mapa com o hash de cada arquivo e aquece os chunks com fetch', async () => {
    browser({ map: 'ok' })
    const verified = await load()
    expect(await verified(build)).toBe(build.entry)
    expect(mapped()).toEqual(build.sri)
    expect(fetch).toHaveBeenCalledWith(CDN + 'split/a.js', { priority: 'auto' })
    // Nunca modulepreload neste caminho: o WebKit ignoraria o hash.
    expect(document.head.querySelector('link[rel="modulepreload"]')).toBeNull()
  })

  it('o primeiro mapa leva dois módulos de teste com o mesmo hash; os próximos, não', async () => {
    browser({ map: 'ok' })
    const verified = await load()
    await verified(build)
    await verified(build)
    const [first, second] = [...document.head.querySelectorAll('script[type="importmap"]')].map((s) => JSON.parse(s.textContent!).integrity)
    expect(first).toEqual({ ...build.sri, [data('export{}')]: PROBE_SRI, [data('throw new Error("hash")')]: PROBE_SRI })
    expect(second).toEqual(build.sri)
  })

  it('CSS fica fora do mapa (não passa por import map)', async () => {
    browser({ map: 'ok' })
    const css = CDN + 'remote.css'
    await (await load())({ ...build, sri: { ...build.sri, [css]: sha('css'), [css + '?v=1']: sha('css') } })
    expect(mapped()).toEqual(build.sri)
  })

  it('mapa aceito sem conferir o hash (ou recusado em silêncio) cai para o caminho 2', async () => {
    browser({ map: 'silent', preload: checks })
    const verified = await load()
    expect(await verified(build)).toBe(build.entry)
    expect(document.head.querySelector(`link[rel="modulepreload"][href="${build.entry}"]`)).not.toBeNull()
    // E não tenta de novo nos próximos remotes.
    await verified(build)
    expect(document.head.querySelectorAll('script[type="importmap"]')).toHaveLength(1)
  })

  it('mapa aceito sem conferir, sem caminho 2: fica com o caminho 3', async () => {
    browser({ map: 'silent', preload: ignores })
    expect(await (await load())(build)).toBeUndefined()
  })

  it('navegador sem import map nem tenta o mapa', async () => {
    browser({ map: 'ok', preload: checks })
    vi.spyOn(HTMLScriptElement, 'supports').mockReturnValue(false)
    expect(await (await load())(build)).toBe(build.entry)
    expect(document.head.querySelector('script[type="importmap"]')).toBeNull()
  })

  it('copia o nonce da página, para passar pela CSP', async () => {
    browser({ map: 'ok' })
    const page = document.createElement('script')
    page.nonce = 'abc123'
    page.setAttribute('nonce', '')
    document.head.append(page)
    await (await load())(build)
    expect(document.head.querySelector<HTMLScriptElement>('script[type="importmap"]')!.nonce).toBe('abc123')
  })

  it('mapa recusado (import map tardio) desliga o caminho 1 para os próximos', async () => {
    browser({ map: 'error', preload: checks })
    const verified = await load()
    expect(await verified(build)).toBe(build.entry)
    expect(await verified(build)).toBe(build.entry)
    expect(document.head.querySelectorAll('script[type="importmap"]')).toHaveLength(1)
    expect(document.head.querySelectorAll(`link[rel="modulepreload"][href^="${CDN}"]`)).toHaveLength(4)
  })

  it('mapa bloqueado pela CSP também cai para o caminho 2', async () => {
    browser({ map: 'csp', preload: checks })
    expect(await (await load())(build)).toBe(build.entry)
    expect(document.head.querySelector(`link[rel="modulepreload"][href="${build.entry}"]`)).not.toBeNull()
  })

  it('Trusted Types (textContent recusado) cai para os outros caminhos', async () => {
    browser({ map: 'ok', preload: ignores })
    vi.spyOn(HTMLScriptElement.prototype, 'textContent', 'set').mockImplementation(() => {
      throw new TypeError('TrustedScript')
    })
    expect(await (await load())(build)).toBeUndefined()
  })
})

describe('caminho 2: modulepreload com integrity', () => {
  it('chunks antes da entrada, cada um com o próprio hash', async () => {
    browser({ map: 'error', preload: checks })
    await (await load())(build)
    const links = [...document.head.querySelectorAll<HTMLLinkElement>(`link[rel="modulepreload"][href^="${CDN}"]`)]
    expect(links.map((l) => [l.href, l.integrity, l.crossOrigin])).toEqual([
      [CDN + 'split/a.js', build.sri[CDN + 'split/a.js'], 'anonymous'],
      [build.entry, build.sri[build.entry], 'anonymous'],
    ])
    // Os import() do remote (helper do plugin) leem os hashes daqui.
    expect((globalThis as any)[Symbol.for('vitral')].sri).toMatchObject(build.sri)
  })

  it('navegador que ignora o hash do preload fica com o caminho 3', async () => {
    browser({ map: 'error', preload: ignores })
    expect(await (await load())(build)).toBeUndefined()
    expect(document.head.querySelector(`link[href^="${CDN}"]`)).toBeNull()
  })

  it('navegador sem modulepreload fica com o caminho 3', async () => {
    browser({ map: 'error' })
    vi.spyOn(HTMLLinkElement.prototype, 'relList', 'get').mockReturnValue({ supports: () => false } as any)
    expect(await (await load())(build)).toBeUndefined()
  })

  it('sem resposta do teste em 3s, fica com o caminho 3', async () => {
    browser({ map: 'error', preload: () => null })
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const result = (await load())(build)
    while (!document.head.querySelector('link[href^="data:"]')) await new Promise((r) => setImmediate(r))
    await vi.advanceTimersByTimeAsync(3000)
    expect(await result).toBeUndefined()
    vi.useRealTimers()
  })

  it('arquivo com hash errado rejeita (e o loader cai para o blob:)', async () => {
    browser({ map: 'error', preload: (href) => checks(href, '') && !href.endsWith('a.js') })
    await expect((await load())(build)).rejects.toBeDefined()
  })
})

describe('hashes fora do formato estrito', () => {
  for (const [caso, sri] of [
    ['base64url', 'sha384-abc_def-'],
    ['algoritmo desconhecido', 'md5-abc'],
    ['opções depois do hash', sha('a') + '?ct=x'],
    ['faltando', undefined],
  ] as const) {
    it(`${caso}: nem tenta, vai direto para o blob:`, async () => {
      browser({ map: 'ok' })
      const b = { ...build, sri: { ...build.sri, [CDN + 'split/a.js']: sri! } }
      expect(await (await load())(b)).toBeUndefined()
      expect(document.head.querySelector('script[type="importmap"]')).toBeNull()
    })
  }

  it('vários hashes separados por espaço valem', async () => {
    browser({ map: 'ok' })
    const b = { ...build, sri: { ...build.sri, [build.entry]: `${sha('x')} sha512-${'A'.repeat(86)}==` } }
    expect(await (await load())(b)).toBe(build.entry)
  })
})

describe('loader com os três caminhos', () => {
  const code = 'export default { mount() { return { unmount() {} } } }'

  async function lib() {
    const index = await import('../src/index')
    index.configure({ allowedOrigins: ['*'], retries: 0 })
    return index
  }
  const fetchManifest = (m: object) =>
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.endsWith('.json') ? new Response(JSON.stringify(m)) : new Response(code))))
  const maps = () => (document.head.querySelector('script[type="importmap"]') ? [mapped()] : [])

  afterEach(async () => (await import('../src/index')).__reset())

  it('caminho 1: importa a entrada dividida da própria URL, sem blob:', async () => {
    browser({ map: 'ok' })
    const entry = data(code)
    fetchManifest({ entry: 'remote.js', integrity: sha(code), files: { [entry]: sha(code), 'remote.css': sha('css') }, split: { entry } })
    const { register, loadRemote } = await lib()
    register('x', CDN + 'vitral.json')
    expect(typeof (await loadRemote('x')).mount).toBe('function')
    expect(maps()).toEqual([{ [entry]: sha(code) }])
    expect(remoteBlobs()).toEqual([])
  })

  it('integrity fixada pelo host: ignora o build dividido do manifesto', async () => {
    browser({ map: 'ok', blob: data(code) })
    const split = data('throw 1')
    fetchManifest({ entry: 'remote.js', integrity: sha('outro'), files: { [split]: sha('throw 1') }, split: { entry: split } })
    const { register, loadRemote } = await lib()
    register('x', { url: CDN + 'vitral.json', integrity: sha(code) })
    expect(typeof (await loadRemote('x')).mount).toBe('function')
    expect(maps()).toEqual([{ [CDN + 'remote.js']: sha(code) }])
  })

  it('falha no caminho 1 cai para o blob:, e o remote nunca mais volta ao caminho 1', async () => {
    browser({ map: 'ok', blob: data(code) })
    fetchManifest({ entry: 'remote.js', integrity: sha(code) })
    // O Node não importa https:, então o caminho 1 falha como uma falha de rede.
    const { register, loadRemote } = await lib()
    register('x', CDN + 'vitral.json')
    expect(typeof (await loadRemote('x')).mount).toBe('function')
    register('x', CDN + 'vitral.json')
    await loadRemote('x')
    expect(document.head.querySelectorAll('script[type="importmap"]')).toHaveLength(1)
    expect(remoteBlobs()).toHaveLength(2)
  })

  it('manifesto embutido no registro: nenhuma requisição para o vitral.json', async () => {
    browser({ map: 'ok', blob: data(code) })
    const fetch = vi.fn(async () => new Response(code))
    vi.stubGlobal('fetch', fetch)
    const { register, loadRemote } = await lib()
    register('x', { url: CDN + 'vitral.json', manifest: { name: 'x', entry: 'remote.js', integrity: sha(code) } })
    await loadRemote('x')
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([CDN + 'remote.js'])
  })

  it('dedupe no manifesto: a cópia própria baixa junto e fica oferecida', async () => {
    browser({ map: 'ok' })
    const entry = data(code)
    const own = data('export default { react: "próprio" }')
    fetchManifest({
      entry: 'remote.js',
      integrity: sha(code),
      files: { [entry]: sha(code), [own]: sha('own') },
      split: { entry },
      dedupe: [{ name: 'react', range: '^19.0.0', version: '19.3.0', file: own }],
    })
    const { register, loadRemote } = await lib()
    register('x', CDN + 'vitral.json')
    await loadRemote('x')
    const { protocol } = await import('../src/core/state')
    expect(await protocol().dedupe!('react', '^19.2.0')).toEqual({ react: 'próprio' })
  })

  it('cópia própria em outra origem é bloqueada pela allowlist', async () => {
    fetchManifest({
      entry: 'remote.js',
      integrity: sha(code),
      split: { entry: 'split/remote.js' },
      dedupe: [{ name: 'react', range: '^19.0.0', version: '19.3.0', file: 'https://outro.com/react.js' }],
    })
    const { register, loadRemote, configure } = await lib()
    configure({ allowedOrigins: [new URL(CDN).origin] })
    register('x', CDN + 'vitral.json')
    await expect(loadRemote('x')).rejects.toMatchObject({ code: 'ORIGIN_BLOCKED' })
  })

  it('manifesto sem entry é INVALID_MODULE', async () => {
    fetchManifest({ name: 'x' })
    const { register, loadRemote } = await lib()
    register('x', CDN + 'vitral.json')
    await expect(loadRemote('x')).rejects.toMatchObject({ code: 'INVALID_MODULE' })
  })
})

describe('CSS com SRI', () => {
  it('o hash vai no preload, no <link> e no fetch do Shadow DOM', async () => {
    const css = CDN + 'remote.css'
    const fetch = vi.fn(async () => new Response('.a{}'))
    vi.stubGlobal('fetch', fetch)
    const { injectCss, injectStyles, prefetchCss } = await import('../src/core/css')
    const sri = { [css]: sha('css') }
    prefetchCss({ css: [css], sri }, false)
    expect(document.head.querySelector<HTMLLinkElement>(`link[rel="preload"][href="${css}"]`)!.integrity).toBe(sha('css'))

    const host = document.body.appendChild(document.createElement('div'))
    const make = () => {
      const el = document.createElement('div')
      el.setAttribute('data-vitral-root', 'sri-css')
      return el
    }
    await injectStyles({ css: [css], sri }, host, make, { mirrorTheme: false })
    expect(fetch).toHaveBeenCalledWith(css, expect.objectContaining({ integrity: sha('css') }))

    const done = injectCss([css], null, sri)
    const link = document.head.querySelector<HTMLLinkElement>(`link[rel="stylesheet"][href="${css}"]`)!
    expect(link.integrity).toBe(sha('css'))
    link.dispatchEvent(new Event('load'))
    await done
  })
})

describe('dedupe: cópia própria do remote', () => {
  const own = CDN + 'split/own-react.js'
  const withOwn: SplitBuild = {
    ...build,
    sri: { ...build.sri, [own]: sha('react') },
    dedupe: [{ name: 'react', range: '^19.0.0', version: '19.3.0', file: own }],
  }
  const start = async () => {
    const state = await import('../src/core/state')
    state.resetProtocol()
    const verified = await load()
    const { shared } = await import('../src/core/dedupe')
    return { p: { dedupe: shared(state.protocol()) }, verified }
  }

  it('caminho 1: sem oferta na página, baixa junto com a entrada e fica oferecida aos próximos', async () => {
    browser({ map: 'ok' })
    const { p, verified } = await start()
    const run = vi.fn(async () => ({ default: { react: 'próprio' } }))
    expect(await verified(withOwn, run)).toBe(build.entry)
    expect(run).toHaveBeenCalledWith(own)
    // O mapa já tem o hash da cópia própria antes do import().
    expect(mapped()[own]).toBe(sha('react'))
    expect(await p.dedupe('react', '^19.1.0')).toEqual({ react: 'próprio' })
  })

  it('com uma versão na faixa já oferecida, não baixa a própria', async () => {
    browser({ map: 'ok' })
    const { p, verified } = await start()
    p.dedupe('react', '19.2.0', { version: '19.2.0', load: async () => ({ react: 'host' }) })
    const run = vi.fn(async () => ({}))
    await verified(withOwn, run)
    expect(run).not.toHaveBeenCalled()
  })

  it('caminho 2: a cópia própria passa pelo modulepreload com o hash', async () => {
    browser({ map: 'error', preload: checks })
    const { verified } = await start()
    const run = vi.fn(async () => ({ default: {} }))
    await verified(withOwn, run)
    await vi.waitFor(() => expect(run).toHaveBeenCalledWith(own))
    expect(document.head.querySelector<HTMLLinkElement>(`link[rel="modulepreload"][href="${own}"]`)!.integrity).toBe(sha('react'))
  })

  it('hash da cópia própria fora do formato: vai para o caminho 3', async () => {
    browser({ map: 'ok' })
    const { verified } = await start()
    expect(await verified({ ...withOwn, sri: { ...withOwn.sri, [own]: 'md5-x' } }, vi.fn())).toBeUndefined()
  })
})
