// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { __reset, configure, loadModule, loadRemote, mountRemote, preload, register, RemoteError } from '../src/index'
import { splitName } from '../src/core/expose'
import { protocol } from '../src/core/state'

afterEach(() => {
  __reset()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

const fail = (p: Promise<unknown>) => p.then(() => { throw new Error('deveria falhar') }, (e) => e as RemoteError)
const view = (text: string) => ({
  mount(el: HTMLElement) {
    el.textContent = text
    return { unmount: () => el.replaceChildren() }
  },
})
const data = (code: string) => `data:text/javascript,${encodeURIComponent(code)}`

function loja(extra: Record<string, unknown> = {}) {
  // Como `() => import()`: sempre o mesmo namespace.
  const ns = { default: view('mini') }
  const mini = vi.fn(async () => ns)
  const api = { soma: (a: number, b: number) => a + b }
  register('loja', { module: { default: view('loja'), versao: 3, exposes: { './Mini': mini, './api': api, ...extra } } })
  return { mini }
}

describe('vários componentes por remote', () => {
  it('monta loja/Mini a partir do mapa exposes', async () => {
    loja()
    const host = document.body.appendChild(document.createElement('div'))
    await mountRemote(host, 'loja/Mini', {})
    expect(host.textContent).toBe('mini')
    expect(host.querySelector('[data-vitral-root="loja/Mini"]')).not.toBeNull()
  })

  it('o default continua sendo o remote inteiro', async () => {
    loja()
    const host = document.body.appendChild(document.createElement('div'))
    await mountRemote(host, 'loja', {})
    expect(host.textContent).toBe('loja')
  })

  it('baixa o arquivo do remote uma vez só para todas as partes', async () => {
    const file = vi.fn(async () => ({ default: view('loja'), exposes: { './A': { default: view('a') }, './B': { default: view('b') } } }))
    register('loja', { module: file })
    preload('loja/A')
    const [a, b, a2] = await Promise.all([loadRemote('loja/A'), loadRemote('loja/B'), loadRemote('loja/A')])
    expect(a).toBe(a2)
    expect(a).not.toBe(b)
    expect(file).toHaveBeenCalledTimes(1)
  })

  it('a mesma parte devolve o mesmo módulo', async () => {
    const { mini } = loja()
    expect(await loadRemote('loja/Mini')).toBe(await loadRemote('loja/Mini'))
    expect(mini).toHaveBeenCalledTimes(2)
  })

  it('parte que não existe é NOT_EXPOSED e lista as que existem', async () => {
    loja()
    const e = await fail(loadRemote('loja/Nada'))
    expect(e.code).toBe('NOT_EXPOSED')
    expect(e.remote).toBe('loja/Nada')
    expect(e.message).toContain('./Mini, ./api')
  })

  it('remote sem exposes também é NOT_EXPOSED', async () => {
    register('x', { module: view('x') })
    expect((await fail(loadRemote('x/Mini'))).code).toBe('NOT_EXPOSED')
  })

  it('módulo sem UI como componente é INVALID_MODULE, com a dica de loadModule', async () => {
    loja()
    const e = await fail(mountRemote(document.body, 'loja/api', {}))
    expect(e.code).toBe('INVALID_MODULE')
    expect(e.message).toContain('loadModule')
  })

  it('falha ao carregar a parte é LOAD_FAILED e não fica em cache', async () => {
    let n = 0
    loja({ './Instavel': async () => (++n === 1 ? Promise.reject(new Error('rede')) : { default: view('ok') }) })
    expect((await fail(loadRemote('loja/Instavel'))).code).toBe('LOAD_FAILED')
    expect(typeof (await loadRemote('loja/Instavel')).mount).toBe('function')
    expect(n).toBe(2)
  })

  it('nome com / usa o maior prefixo registrado', async () => {
    register('@loja/carrinho', { module: { default: view('c'), exposes: { './Mini': { default: view('m') } } } })
    expect(splitName('@loja/carrinho/Mini')).toEqual(['@loja/carrinho', './Mini'])
    expect(splitName('@loja/carrinho')).toEqual(['@loja/carrinho', null])
    expect(splitName('nada/x')).toEqual(['nada/x', null])
    const host = document.body.appendChild(document.createElement('div'))
    await mountRemote(host, '@loja/carrinho/Mini', {})
    expect(host.textContent).toBe('m')
  })

  it('nome não registrado continua NOT_REGISTERED', async () => {
    const e = await fail(loadRemote('nada/Mini'))
    expect(e.code).toBe('NOT_REGISTERED')
    expect(e.remote).toBe('nada/Mini')
  })

  it('espera o remotes.json antes de dividir o nome', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ loja: data('export default {}; export const exposes = { "./api": { ok: 1 } }') }))))
    configure({ remotes: 'https://cdn.empresa.com/remotes.json', allowedOrigins: ['*'] })
    expect(await loadModule('loja/api')).toEqual({ ok: 1 })
  })
})

describe('loadModule', () => {
  it('devolve o módulo exposto, sem exigir mount', async () => {
    loja()
    const api = await loadModule<{ soma(a: number, b: number): number }>('loja/api')
    expect(api.soma(2, 3)).toBe(5)
  })

  it('sem /, devolve os exports do arquivo principal', async () => {
    loja()
    expect((await loadModule<{ versao: number }>('loja')).versao).toBe(3)
  })

  it('vem pela rede com a mesma allowlist', async () => {
    configure({ allowedOrigins: ['https://cdn.empresa.com'] })
    register('x', data('export const n = 1'))
    expect((await fail(loadModule('x'))).code).toBe('ORIGIN_BLOCKED')
  })

  it('módulo de rede sem mount serve para loadModule, não para loadRemote', async () => {
    configure({ allowedOrigins: ['*'] })
    register('x', data('export const n = 1; export const exposes = { "./b": () => ({ b: 2 }) }'))
    expect((await loadModule<{ n: number }>('x')).n).toBe(1)
    expect(await loadModule('x/b')).toEqual({ b: 2 })
    expect((await fail(loadRemote('x'))).code).toBe('INVALID_MODULE')
  })

  it('remote carregado por cópia antiga (sem exports) dá erro claro', async () => {
    register('x', { module: view('x') })
    await protocol().load('x', async () => ({ module: view('x'), entry: 'http://localhost/', css: [] }))
    const e = await fail(loadModule('x'))
    expect(e.code).toBe('INVALID_MODULE')
    expect(e.message).toContain('cópia antiga')
  })
})
