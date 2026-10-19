// @vitest-environment happy-dom
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { __reset, configure, loadModule, mountRemote, type RemoteError, type RemoteModule } from '../src/index'
import { federationRemote, shareScope } from '../src/federation'
import * as fixture from './fixtures/mf-container.mjs'

afterEach(() => {
  __reset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
  fixture.inits.length = 0
})

const DIR = pathToFileURL(resolve(__dirname, 'fixtures')).href + '/'
const fail = (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error('deveria falhar')
    },
    (e) => e as RemoteError,
  )
const host = () => document.body.appendChild(document.createElement('div'))
let n = 0

/** `mf-manifest.json` como o do @module-federation/enhanced 2.x, servido por um fetch falso numa URL nova. */
function manifest(over: { remoteEntry?: object; metaData?: object; exposes?: string[] } = {}, url = `${DIR}mf-${++n}/mf-manifest.json`) {
  const body = {
    id: 'carrinho',
    name: 'carrinho',
    metaData: {
      name: 'carrinho',
      type: 'app',
      globalName: 'carrinho',
      publicPath: DIR,
      remoteEntry: { name: 'mf-container.mjs', path: '', type: 'module', ...over.remoteEntry },
      ...over.metaData,
    },
    shared: [{ id: 'carrinho:libx', name: 'libx', version: '1.2.0', singleton: true, requiredVersion: '^1.0.0' }],
    remotes: [],
    exposes: (over.exposes ?? ['./Carrinho', './Contador', './api']).map((path) => ({ id: 'carrinho:' + path.slice(2), name: path.slice(2), path })),
  }
  const fetch = vi.fn(async (u: string) => (u.split('?')[0] === url ? Response.json(body) : new Response('', { status: 404 })))
  vi.stubGlobal('fetch', fetch)
  return { url, fetch }
}

describe('federationRemote', () => {
  it('monta uma parte exposta que já exporta mount, com update e unmount', async () => {
    const { url } = manifest()
    configure({ remotes: { carrinho: federationRemote(url) } })
    const el = host()
    const r = await mountRemote(el, 'carrinho/Carrinho', { n: 1 })
    expect(el.textContent).toBe('carrinho/Carrinho:1:remote')
    r.update?.({ n: 2 })
    expect(el.textContent).toBe('carrinho/Carrinho:2:remote')
    r.unmount()
    expect(el.textContent).toBe('')
    expect(fixture.inits).toEqual([{}])
  })

  it('oferece as dependências do host no share scope, no formato do webpack', async () => {
    const libx = { quem: 'host' }
    expect(shareScope({ libx: { version: '1.5.0', modules: { libx, 'libx/extra': 1 } } })).toEqual({
      libx: { '1.5.0': { get: expect.any(Function), loaded: 1, from: 'vitral' } },
      'libx/extra': { '1.5.0': { get: expect.any(Function), loaded: 1, from: 'vitral' } },
    })
    const { url } = manifest()
    configure({ remotes: { carrinho: federationRemote(url, { expose: 'Carrinho', shared: { libx: { version: '1.5.0', modules: { libx } } } }) } })
    const el = host()
    await mountRemote(el, 'carrinho', { n: 1 })
    expect(el.textContent).toBe('carrinho:1:host')
  })

  it('usa a própria cópia do remote quando a versão oferecida não serve', async () => {
    const { url } = manifest()
    configure({ remotes: { carrinho: federationRemote(url, { expose: './Carrinho', shared: { libx: { version: '2.0.0', modules: { libx: { quem: 'host' } } } } }) } })
    const el = host()
    await mountRemote(el, 'carrinho', { n: 1 })
    expect(el.textContent).toBe('carrinho:1:remote')
  })

  it('adapt transforma um componente exposto num remote', async () => {
    const { url } = manifest()
    const adapt = vi.fn((m: { default: (p: { n: number }) => string }, key: string): RemoteModule<any> | undefined =>
      key === './api'
        ? undefined
        : {
            mount(el, props) {
              el.textContent = m.default(props as { n: number })
              return { unmount: () => el.replaceChildren() }
            },
          },
    )
    configure({ remotes: { carrinho: federationRemote(url, { adapt }) } })
    const el = host()
    await mountRemote(el, 'carrinho/Contador', { n: 3 })
    expect(el.textContent).toBe('contador 3')
    expect(adapt).toHaveBeenCalledWith(expect.objectContaining({ extra: 1 }), './Contador')
    // Os outros exports continuam lá para loadModule; módulo sem UI passa direto.
    expect(await loadModule('carrinho/Contador')).toMatchObject({ extra: 1 })
    const api = await loadModule<{ soma(a: number, b: number): number }>('carrinho/api')
    expect(api.soma(1, 2)).toBe(3)
    // Parte com mount não passa por adapt.
    await mountRemote(host(), 'carrinho/Carrinho', { n: 1 })
    expect(adapt).toHaveBeenCalledTimes(2)
  })

  it('o container é iniciado uma vez e cada parte é pedida uma vez', async () => {
    const { url, fetch } = manifest()
    const get = vi.spyOn(fixture, 'get')
    configure({ remotes: { a: federationRemote(url), b: federationRemote(url) } })
    await mountRemote(host(), 'a/Carrinho', { n: 1 })
    await mountRemote(host(), 'a/Carrinho', { n: 2 })
    await mountRemote(host(), 'b/Carrinho', { n: 3 })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fixture.inits).toHaveLength(1)
    // Um get por nome registrado (cada nome tem o próprio mapa de partes).
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('erros: parte inexistente, sem mount, sem parte padrão', async () => {
    const { url } = manifest()
    configure({ remotes: { carrinho: federationRemote(url) } })
    expect((await fail(mountRemote(host(), 'carrinho/Nada', {}))).code).toBe('NOT_EXPOSED')
    const semMount = await fail(mountRemote(host(), 'carrinho/Contador', {}))
    expect(semMount.code).toBe('INVALID_MODULE')
    const semPadrao = await fail(mountRemote(host(), 'carrinho', {}))
    expect(semPadrao.code).toBe('MOUNT_FAILED')
    expect(String((semPadrao.cause as Error).message)).toContain('o manifesto expõe ./Carrinho, ./Contador, ./api')
  })

  it('a única parte do manifesto é a padrão; expose sem mount explica o adapt', async () => {
    const um = manifest({ exposes: ['./Carrinho'] })
    configure({ remotes: { carrinho: federationRemote(um.url) } })
    const el = host()
    await mountRemote(el, 'carrinho', { n: 5 })
    expect(el.textContent).toBe('carrinho:5:remote')
    const outro = manifest()
    configure({ remotes: { contador: federationRemote(outro.url, { expose: './Contador' }) } })
    const e = await fail(mountRemote(host(), 'contador', {}))
    expect(String((e.cause as Error).message)).toContain('./Contador não exporta mount(). Use a opção adapt')
  })

  it('remoteEntry global: injeta o script e lê a variável global', async () => {
    const { url } = manifest({ remoteEntry: { name: 'remoteEntry.js', path: 'static', type: 'global' }, metaData: { globalName: 'carrinho_mf' } })
    const scripts: string[] = []
    vi.spyOn(document.head, 'appendChild').mockImplementation(((s: HTMLScriptElement) => {
      scripts.push(s.src)
      ;(window as any).carrinho_mf = fixture
      queueMicrotask(() => s.onload?.(new Event('load')))
      return s
    }) as any)
    configure({ remotes: { carrinho: federationRemote(url) } })
    const el = host()
    await mountRemote(el, 'carrinho/Carrinho', { n: 1 })
    expect(el.textContent).toBe('carrinho/Carrinho:1:remote')
    expect(scripts).toEqual([DIR + 'static/remoteEntry.js'])
    delete (window as any).carrinho_mf
  })

  it('remoteEntry global já carregado pelo host do Module Federation é reaproveitado', async () => {
    const { url } = manifest({ remoteEntry: { type: 'var' }, metaData: { globalName: 'ja_carregado' } })
    ;(window as any).ja_carregado = fixture
    const append = vi.spyOn(document.head, 'appendChild')
    configure({ remotes: { carrinho: federationRemote(url) } })
    await mountRemote(host(), 'carrinho/Carrinho', { n: 1 })
    expect(append).not.toHaveBeenCalled()
    delete (window as any).ja_carregado
  })

  it('script que falha vira LOAD_FAILED, e o retry tenta de novo', async () => {
    const { url } = manifest({ remoteEntry: { type: 'global' }, metaData: { globalName: 'cai' } })
    let tentativas = 0
    vi.spyOn(document.head, 'appendChild').mockImplementation(((s: HTMLScriptElement) => {
      if (++tentativas > 1) (window as any).cai = fixture
      queueMicrotask(() => (tentativas > 1 ? s.onload : s.onerror)?.(new Event('x')))
      return s
    }) as any)
    configure({ remotes: { carrinho: federationRemote(url) } })
    const e = await fail(mountRemote(host(), 'carrinho/Carrinho', { n: 1 }))
    expect(e.code).toBe('LOAD_FAILED')
    expect(e.message).toContain('falha ao carregar')
    __reset()
    configure({ remotes: { carrinho: federationRemote(url) } })
    await mountRemote(host(), 'carrinho/Carrinho', { n: 1 })
    expect(tentativas).toBe(2)
    delete (window as any).cai
  })

  it('sem manifesto: URL do remoteEntry como ES module', async () => {
    configure({ remotes: { carrinho: federationRemote(DIR + 'mf-container.mjs', { expose: './Carrinho' }) } })
    const el = host()
    await mountRemote(el, 'carrinho', { n: 7 })
    expect(el.textContent).toBe('carrinho:7:remote')
    expect((await fail(mountRemote(host(), 'carrinho/Nada', {}))).code).toBe('LOAD_FAILED')
  })

  it('confere a origem do remoteEntry e recusa manifesto inválido', async () => {
    const outra = manifest({ metaData: { publicPath: 'https://outro.cdn.com/carrinho/' } })
    configure({ remotes: { carrinho: federationRemote(outra.url) } })
    expect((await fail(mountRemote(host(), 'carrinho/Carrinho', {}))).message).toContain('remoteEntry em https://outro.cdn.com não está em allowedOrigins')

    const getPublicPath = manifest({ metaData: { publicPath: undefined, getPublicPath: 'return "x"' } })
    configure({ remotes: { b: federationRemote(getPublicPath.url) } })
    expect((await fail(mountRemote(host(), 'b/Carrinho', {}))).message).toContain('getPublicPath não é suportado')

    const quebrado = `${DIR}quebrado/mf-manifest.json`
    vi.stubGlobal('fetch', async () => Response.json({ name: 'x' }))
    configure({ remotes: { c: federationRemote(quebrado) } })
    expect((await fail(mountRemote(host(), 'c/X', {}))).message).toContain('não é um mf-manifest.json')

    vi.stubGlobal('fetch', async () => new Response('', { status: 404 }))
    configure({ remotes: { d: federationRemote(`${DIR}sumiu/mf-manifest.json`) } })
    expect((await fail(mountRemote(host(), 'd/X', {}))).message).toContain('HTTP 404')

    configure({ remotes: { e: federationRemote(`data:text/javascript,${encodeURIComponent('export const x = 1')}`, { allowedOrigins: ['*'] }) } })
    expect((await fail(mountRemote(host(), 'e/X', {}))).message).toContain('não é um container do Module Federation')
  })

  it('allowedOrigins libera o publicPath em outra origem que a do manifesto', async () => {
    const { url } = manifest({}, 'https://cdn.loja.com/carrinho/mf-manifest.json')
    configure({ remotes: { a: federationRemote(url), b: federationRemote(url + '?v=2', { allowedOrigins: ['null'] }) } })
    // O publicPath aponta para file: (origem "null"), outra origem que a do manifesto.
    expect((await fail(mountRemote(host(), 'a/Carrinho', {}))).message).toContain('remoteEntry em null não está em allowedOrigins')
    const el = host()
    await mountRemote(el, 'b/Carrinho', { n: 1 })
    expect(el.textContent).toBe('b/Carrinho:1:remote')
  })
})
