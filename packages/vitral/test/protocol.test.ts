// @vitest-environment happy-dom
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { __reset, configure, loadRemote, mountRemote, preload, register, RemoteError, type RemoteContext } from '../src/index'
import { ERROR_DOCS } from '../src/core/errors'
import { verifyIntegrity } from '../src/core/integrity'
import { protocol, PROTOCOL } from '../src/core/state'

afterEach(() => {
  __reset()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.body.replaceChildren()
})

const KEY = Symbol.for('vitral')
const fail = (p: Promise<unknown>) => p.then(() => { throw new Error('deveria falhar') }, (e) => e as RemoteError)
const remote = (ctxs: RemoteContext[] = []) => ({
  mount: vi.fn((_el: HTMLElement, _p: unknown, ctx: RemoteContext) => {
    ctxs.push(ctx)
    return { unmount: vi.fn() }
  }),
})

describe('protocolo global', () => {
  it('duas cópias da lib compartilham registros e módulos', async () => {
    vi.resetModules()
    const a = await import('../src/index')
    vi.resetModules()
    const b = await import('../src/index')
    expect(a.register).not.toBe(b.register)

    const load = vi.fn(async () => remote())
    a.register('x', { module: load })
    const [ma, mb] = await Promise.all([a.loadRemote('x'), b.loadRemote('x')])
    expect(ma).toBe(mb)
    expect(load).toHaveBeenCalledTimes(1)

    const got: number[] = []
    b.events.on('n', (v: number) => got.push(v))
    a.events.emit('n', 1)
    expect(got).toEqual([1])
  })

  it('fica em globalThis[Symbol.for("vitral")] com só o número e métodos', () => {
    const p = protocol()
    expect((globalThis as any)[KEY]).toBe(p)
    expect(p.protocol).toBe(PROTOCOL)
    for (const [k, v] of Object.entries(p)) {
      if (k !== 'protocol' && k !== 'events') expect(typeof v, k).toBe('function')
    }
  })

  it('substitui um protocolo mais antigo e mantém um mais novo', () => {
    ;(globalThis as any)[KEY] = { protocol: 0 }
    expect(protocol().protocol).toBe(PROTOCOL)
    const newer = { ...protocol(), protocol: PROTOCOL + 1 }
    ;(globalThis as any)[KEY] = newer
    expect(protocol()).toBe(newer)
  })

  it('o remote recebe ctx.protocol', async () => {
    const ctxs: RemoteContext[] = []
    register('x', { module: remote(ctxs) })
    await mountRemote(document.body.appendChild(document.createElement('div')), 'x', {})
    expect(ctxs[0].protocol).toBe(PROTOCOL)
  })
})

describe('erros', () => {
  it('todo RemoteError aponta para a página do código', () => {
    const e = new RemoteError('TIMEOUT', 'x', 'demorou')
    expect(e.docs).toBe('https://joaogabriel15.github.io/vitral/erros/TIMEOUT')
    expect(e.message).toBe(`[vitral] x: demorou (${ERROR_DOCS}TIMEOUT)`)
  })

  it('todo código tem página em docs/erros', () => {
    const src = readFileSync(resolve(__dirname, '../src/core/errors.ts'), 'utf8')
    const codes = [...src.matchAll(/\| '([A-Z_]+)'/g)].map((m) => m[1])
    expect(codes.length).toBeGreaterThan(5)
    for (const code of codes) expect(existsSync(resolve(__dirname, `../../../docs/erros/${code}.md`)), code).toBe(true)
  })
})

describe('integridade (SRI)', () => {
  const sri = (alg: 'sha256' | 'sha384' | 'sha512', data: Uint8Array) => `${alg}-${createHash(alg).update(data).digest('base64')}`
  const code = new TextEncoder().encode('export default { mount(){} }')
  const buf = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer

  it('confere os bytes exatos, inclusive BOM', async () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...code])
    await verifyIntegrity('x', buf(withBom), sri('sha384', withBom))
    const e = await fail(verifyIntegrity('x', buf(withBom), sri('sha384', code)))
    expect(e.code).toBe('INTEGRITY')
  })

  it('com vários hashes, decide o algoritmo mais forte', async () => {
    await verifyIntegrity('x', buf(code), `sha256-errado ${sri('sha384', code)}`)
    expect((await fail(verifyIntegrity('x', buf(code), `${sri('sha256', code)} sha384-errado`))).code).toBe('INTEGRITY')
    await verifyIntegrity('x', buf(code), `${sri('sha512', code)} sha512-outro`)
  })

  it('aceita base64url e opções depois do hash', async () => {
    const url = sri('sha256', code).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    await verifyIntegrity('x', buf(code), `${url}?ct=application/javascript`)
  })

  it('formato inválido é erro, não passa em silêncio', async () => {
    const e = await fail(verifyIntegrity('x', buf(code), 'md5-abc'))
    expect(e.code).toBe('INTEGRITY')
    expect(e.message).toContain('formato')
  })

  it('a mensagem mostra o esperado e o obtido', async () => {
    const e = await fail(verifyIntegrity('x', buf(code), 'sha384-AAAA'))
    expect(e.message).toContain('esperado sha384-AAAA')
    expect(e.message).toContain(`obtido ${sri('sha384', code)}`)
  })
})

describe('carregamento', () => {
  it('timeout vira TIMEOUT', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('abortado', 'AbortError')))
    })))
    configure({ timeout: 20, retries: 0 })
    register('x', { url: 'https://cdn.empresa.com/r.js', integrity: 'sha384-AAAA' })
    expect((await fail(loadRemote('x'))).code).toBe('TIMEOUT')
  })

  it('tenta de novo com espera crescente (200ms, 400ms)', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn(async () => { throw new TypeError('rede caiu') })
    vi.stubGlobal('fetch', fetch)
    configure({ retries: 2 })
    register('x', { url: 'https://cdn.empresa.com/r.js', integrity: 'sha384-AAAA' })
    const result = fail(loadRemote('x'))
    await vi.advanceTimersByTimeAsync(0)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(199)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(400)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect((await result).code).toBe('LOAD_FAILED')
  })

  it('não repete erros que não são de rede', async () => {
    const fetch = vi.fn(async () => new Response('codigo'))
    vi.stubGlobal('fetch', fetch)
    configure({ retries: 3 })
    register('x', { url: 'https://cdn.empresa.com/r.js', integrity: 'sha384-AAAA' })
    expect((await fail(loadRemote('x'))).code).toBe('INTEGRITY')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('preload baixa uma vez só e loadRemote reaproveita', async () => {
    const load = vi.fn(async () => remote())
    register('x', { module: load })
    preload('x')
    preload('x')
    await loadRemote('x')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('register de novo descarta o módulo antigo', async () => {
    const a = remote()
    const b = remote()
    register('x', { module: a })
    expect(await loadRemote('x')).toBe(a)
    register('x', { module: b })
    expect(await loadRemote('x')).toBe(b)
  })

  it('módulo local sem mount() é INVALID_MODULE', async () => {
    register('x', { module: { nada: 1 } as any })
    expect((await fail(loadRemote('x'))).code).toBe('INVALID_MODULE')
  })

  it('configure com URL resolve caminhos relativos ao remotes.json', async () => {
    const fetch = vi.fn(async (url: string) =>
      url.endsWith('remotes.json')
        ? new Response(JSON.stringify({ a: './a/vitral.json', b: { url: 'b/r.js', integrity: 'sha384-AAAA' } }))
        : new Response(JSON.stringify({ entry: 'remote-1.js' })),
    )
    vi.stubGlobal('fetch', fetch)
    configure({ remotes: 'https://cdn.empresa.com/mf/remotes.json', retries: 0 })
    await protocol().pending()
    expect(protocol().entry('a')?.url).toBe('https://cdn.empresa.com/mf/a/vitral.json')
    expect(protocol().entry('b')).toEqual({ url: 'https://cdn.empresa.com/mf/b/r.js', integrity: 'sha384-AAAA' })
    // A origem registrada entra na allowlist padrão, e o manifesto é sempre revalidado.
    const e = await fail(loadRemote('a'))
    expect(fetch).toHaveBeenCalledWith('https://cdn.empresa.com/mf/a/vitral.json', expect.objectContaining({ cache: 'no-cache' }))
    // O JS sai relativo ao manifesto (o Node não importa https:, então só falha no import).
    expect(e.message).toContain('falha ao importar https://cdn.empresa.com/mf/a/remote-1.js')
  })

  it('remotes.json com JSON inválido faz loadRemote falhar com INVALID_MODULE', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>')))
    configure({ remotes: 'https://cdn.empresa.com/remotes.json' })
    register('x', { module: remote() })
    expect((await fail(loadRemote('x'))).code).toBe('INVALID_MODULE')
  })
})

describe('CSS', () => {
  const ok = (body: string) => vi.fn(async () => new Response(body))

  it('o mesmo CSS entra uma vez só no documento', async () => {
    const href = 'https://cdn.empresa.com/dedupe.css'
    register('a', { module: remote(), css: [href] })
    register('b', { module: remote(), css: [href] })
    const host = document.body.appendChild(document.createElement('div'))
    const mounting = Promise.all([mountRemote(host, 'a', {}), mountRemote(host, 'b', {})])
    // happy-dom não baixa o CSS: dispara o load à mão.
    await new Promise((r) => setTimeout(r, 0))
    const links = document.head.querySelectorAll(`link[href="${href}"]`)
    expect(links).toHaveLength(1)
    links[0].dispatchEvent(new Event('load'))
    await mounting
  })

  it('em Shadow DOM usa adoptedStyleSheets e sobe @property para o documento', async () => {
    const href = 'https://cdn.empresa.com/shadow.css'
    vi.stubGlobal('fetch', ok('@property --tw-shadow-x { syntax: "*"; inherits: false } .card { background: url(img/a.png) }'))
    register('x', { module: remote(), css: [href], isolate: 'shadow' })
    const host = document.body.appendChild(document.createElement('div'))
    await mountRemote(host, 'x', {})
    const sheets = host.shadowRoot!.adoptedStyleSheets
    expect(sheets).toHaveLength(1)
    const text = [...sheets[0].cssRules].map((r) => r.cssText).join('\n')
    expect(text).not.toContain('@property')
    expect(text).toContain('https://cdn.empresa.com/img/a.png')
    const hoisted = document.head.querySelectorAll('style[data-vitral-properties]')
    expect([...hoisted].some((s) => s.textContent!.includes('--tw-shadow-x'))).toBe(true)

    // Segunda montagem: nem baixa de novo nem duplica o stylesheet.
    const other = document.body.appendChild(document.createElement('div'))
    await mountRemote(other, 'x', {})
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(other.shadowRoot!.adoptedStyleSheets[0]).toBe(sheets[0])
  })

  it('CSS que falha em Shadow DOM não impede a montagem', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('404.css')) return new Response('', { status: 404 })
      throw new TypeError('rede caiu')
    }))
    register('x', { module: remote(), css: ['https://cdn.empresa.com/404.css', 'https://cdn.empresa.com/offline.css'], isolate: 'shadow' })
    const host = document.body.appendChild(document.createElement('div'))
    await mountRemote(host, 'x', {})
    expect(host.shadowRoot!.querySelector('[data-vitral-root="x"]')).not.toBeNull()
  })

  it('o JS sai relativo ao manifesto ou à URL registrada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ entry: 'r.js', css: ['a.css'], scope: 'cartao' }))))
    configure({ retries: 0 })
    register('x', { url: 'https://cdn.empresa.com/c/vitral.json', css: ['extra.css'] })
    expect((await fail(loadRemote('x'))).message).toContain('https://cdn.empresa.com/c/r.js')
    register('y', { url: 'https://cdn.empresa.com/d/r.js', css: ['y.css'] })
    expect((await fail(loadRemote('y'))).message).toContain('https://cdn.empresa.com/d/r.js')
  })
})

describe('desmontagem', () => {
  it('remove o DOM e cancela as assinaturas do remote', async () => {
    const seen: number[] = []
    const unmount = vi.fn()
    register('x', {
      module: {
        mount(el: HTMLElement, _p: unknown, ctx: RemoteContext) {
          el.textContent = 'oi'
          ctx.events.on('n', (v: number) => seen.push(v))
          return { unmount }
        },
      },
    })
    const host = document.body.appendChild(document.createElement('div'))
    const m = await mountRemote(host, 'x', {})
    protocol().events.emit('n', 1)
    m.unmount()
    m.unmount()
    protocol().events.emit('n', 2)
    expect(seen).toEqual([1])
    expect(unmount).toHaveBeenCalledTimes(1)
    expect(host.innerHTML).toBe('')
  })

  it('se mount() falha, limpa o que criou', async () => {
    register('x', { module: { mount: () => { throw new Error('boom') } } })
    const host = document.body.appendChild(document.createElement('div'))
    expect((await fail(mountRemote(host, 'x', {}))).code).toBe('MOUNT_FAILED')
    expect(host.innerHTML).toBe('')
  })
})

describe('import do remote', () => {
  const data = (code: string) => `data:text/javascript,${encodeURIComponent(code)}`

  it('importa a URL direta quando não há integrity', async () => {
    configure({ allowedOrigins: ['*'] })
    register('x', data('export default { mount() { return { unmount() {} } } }'))
    expect(typeof (await loadRemote('x')).mount).toBe('function')
  })

  it('aceita módulo com mount() exportado por nome', async () => {
    configure({ allowedOrigins: ['*'] })
    register('x', data('export function mount() { return { unmount() {} } }'))
    expect(typeof (await loadRemote('x')).mount).toBe('function')
  })

  it('módulo sem mount() é INVALID_MODULE', async () => {
    configure({ allowedOrigins: ['*'], retries: 0 })
    register('x', data('export default 1'))
    expect((await fail(loadRemote('x'))).code).toBe('INVALID_MODULE')
  })

  it('erro ao executar o módulo é LOAD_FAILED', async () => {
    configure({ allowedOrigins: ['*'], retries: 0 })
    register('x', data('throw new Error("quebrou")'))
    const e = await fail(loadRemote('x'))
    expect(e.code).toBe('LOAD_FAILED')
    expect((e.cause as Error).message).toBe('quebrou')
  })

  it('erro comum de um loader local vira RemoteError', async () => {
    register('x', { module: async () => { throw new Error('sem rede') } })
    const e = await fail(loadRemote('x'))
    expect(e.code).toBe('LOAD_FAILED')
    expect(e.message).toContain('sem rede')
  })
})

describe('contexto do remote', () => {
  it('reportError vai para onError, ou para o console sem onError', async () => {
    const ctxs: RemoteContext[] = []
    register('x', { module: remote(ctxs) })
    const host = document.body.appendChild(document.createElement('div'))
    const onError = vi.fn()
    await mountRemote(host, 'x', {}, { onError })
    ctxs[0].reportError(new Error('render'))
    expect(onError.mock.calls[0][0]).toMatchObject({ code: 'RENDER_FAILED', remote: 'x' })

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await mountRemote(host, 'x', {})
    const original = new RemoteError('TIMEOUT', 'x', 'lento')
    ctxs[1].reportError(original)
    expect(spy).toHaveBeenCalledWith(original)
    spy.mockRestore()
  })

  it('ctx.events emite e lê o barramento global', async () => {
    const ctxs: RemoteContext[] = []
    register('x', { module: remote(ctxs) })
    await mountRemote(document.body.appendChild(document.createElement('div')), 'x', {})
    ctxs[0].events.emit('tema', 'escuro')
    expect(protocol().events.last('tema')).toBe('escuro')
    expect(ctxs[0].events.last('tema')).toBe('escuro')
  })

  it('configure aceita um objeto de remotes', async () => {
    const m = remote()
    configure({ remotes: { x: { module: m }, y: 'https://cdn.empresa.com/y.js' } })
    expect(await loadRemote('x')).toBe(m)
    expect(protocol().entry('y')?.url).toBe('https://cdn.empresa.com/y.js')
  })
})

describe('navigate', () => {
  it('replace troca a entrada do histórico', async () => {
    const { navigate } = await import('../src/index')
    const before = history.length
    navigate('/a', { replace: true })
    expect(location.pathname).toBe('/a')
    expect(history.length).toBe(before)
  })

  it('outra origem faz navegação completa', async () => {
    const { navigate } = await import('../src/index')
    const assign = vi.spyOn(location, 'assign').mockImplementation(() => {})
    navigate('https://outro.com/x')
    expect(assign).toHaveBeenCalledWith('https://outro.com/x')
    assign.mockRestore()
  })
})
