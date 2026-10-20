// @vitest-environment happy-dom
import { resolveObjectURL } from 'node:buffer'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configure, mountRemote, register, type RemoteError } from '../src/index'
import { REFRAME_SCRIPT } from '../src/core/reframe'
import { load as embedLoad, noFrames as embedNoFrames } from '../src/core/reframe-embed'
import { cleanup, flush } from './helpers'

/**
 * O happy-dom não roda scripts de iframe. O script do reframe só instala
 * `window.__vitral` (um `import()` na janela do iframe); aqui a mesma função
 * entra pelo `contentWindow`, e o JS do remote roda no Node. Os testes
 * conferem o `window` e o `document` corrigidos do iframe direto. O e2e
 * (e2e/reframe.spec.ts) roda o remote dentro do iframe de verdade.
 */
const imported: string[] = []
const desc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow')!
let csp = false

beforeEach(() => {
  csp = false
  imported.length = 0
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
    configurable: true,
    get() {
      const w = desc.get!.call(this)
      if (w && !csp && !w.__setup) {
        w.__setup = true
        w.__vitral = async (u: string) => {
          imported.push(u.startsWith('blob:') ? 'blob' : u)
          if (u.startsWith('blob:')) u = `data:text/javascript,${encodeURIComponent(await (resolveObjectURL(u) ?? (await (await fetch(u)).blob())).text())}`
          return import(/* @vite-ignore */ u)
        }
      }
      return w
    },
  })
  configure({ allowedOrigins: ['*'], retries: 0 })
})
afterEach(() => {
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', desc)
  cleanup()
  vi.restoreAllMocks()
  delete g.__ctx
  delete g.__el
})

const g = globalThis as any
// Arquivos de verdade (file:): o mountRemote calcula ctx.baseUrl a partir da URL.
const dir = mkdtempSync(join(__dirname, 'fixtures', '.reframe-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))
let seq = 0
const data = (code: string) => {
  const file = join(dir, `r${seq++}.mjs`)
  writeFileSync(file, code)
  return pathToFileURL(file).href
}
const CARD = `export default { mount(el, p, ctx) {
  globalThis.__ctx = ctx; globalThis.__el = el
  el.innerHTML = '<p id="msg" class="msg">' + p.msg + '</p><input name="campo">'
  return { update(n) { el.querySelector('p').textContent = n.msg }, unmount() { el.textContent = '' } }
} }
export const exposes = { './Mini': { default: { mount(el) { el.textContent = 'mini'; return { unmount() {} } } } } }`
const fail = (p: Promise<unknown>) => p.then(() => { throw new Error('deveria falhar') }, (e) => e as RemoteError)
const frame = () => document.querySelector<HTMLIFrameElement>('iframe[data-vitral-reframe]')
const realm = () => frame()!.contentWindow as Window & typeof globalThis

async function mountIt(name = 'w', props: Record<string, unknown> = { msg: 'oi' }) {
  const host = document.body.appendChild(document.createElement('div'))
  const h = await mountRemote(host, name, props, { isolate: 'reframe' })
  return { host, h }
}

describe("isolate: 'reframe'", () => {
  it('JS no iframe oculto, DOM no shadow root do host; unmount remove o iframe', async () => {
    const url = data(CARD)
    register('w', url)
    const { host, h } = await mountIt()
    const iframe = frame()!
    expect(iframe.style.display).toBe('none')
    expect(iframe.getAttribute('aria-hidden')).toBe('true')
    expect(imported).toEqual([url])
    const root = host.shadowRoot
    expect(g.__ctx.shadowRoot).toBeTruthy()
    expect(g.__ctx.shadowRoot.querySelector('#msg').textContent).toBe('oi')
    expect(root).toBe(g.__ctx.shadowRoot)
    h.update!({ msg: 'tchau' })
    expect(g.__ctx.shadowRoot.querySelector('#msg').textContent).toBe('tchau')
    h.unmount()
    expect(frame()).toBeNull()
    expect(document.querySelector('[data-vitral-head]')).toBeNull()
  })

  it('isolate no registro também vale', async () => {
    register('w', { url: data(CARD), isolate: 'reframe' })
    const host = document.body.appendChild(document.createElement('div'))
    await mountRemote(host, 'w', { msg: 'x' })
    expect(frame()).not.toBeNull()
  })

  it('o document do iframe aponta para o shadow root', async () => {
    register('w', data(CARD))
    await mountIt()
    const d = realm().document
    const root: ShadowRoot = g.__ctx.shadowRoot
    expect(d.querySelector('#msg')).toBe(root.querySelector('#msg'))
    expect(d.querySelectorAll('p').length).toBe(1)
    expect(d.getElementById('msg')).toBe(root.querySelector('#msg'))
    expect(d.getElementsByClassName(' msg ').length).toBe(1)
    expect(d.getElementsByTagName('input').length).toBe(1)
    expect(d.getElementsByName('campo').length).toBe(1)
    // Criado no documento do host, para entrar no shadow root sem adoção.
    const el = d.createElement('div')
    expect(el.ownerDocument).toBe(document)
    expect(d.createTextNode('x').ownerDocument).toBe(document)
    expect(d.createElementNS('http://www.w3.org/2000/svg', 'svg').ownerDocument).toBe(document)
    // head fica no shadow root; body é o destino de portais.
    expect(d.head.parentNode).toBe(root)
    expect(d.head.hidden).toBe(true)
    expect(d.body).toBe(g.__ctx.portalContainer)
    expect(d.documentElement).toBe(document.documentElement)
    d.head.appendChild(Object.assign(d.createElement('style'), { textContent: 'p{color:red}' }))
    expect(root.querySelector('style')!.textContent).toBe('p{color:red}')
    expect(d.activeElement).toBe(document.body)
    root.querySelector<HTMLInputElement>('input')!.focus()
    expect(d.activeElement).toBe(root.querySelector('input'))
  })

  it('<script> posto no head ou no body do remote vai para o iframe', async () => {
    register('w', data(CARD))
    await mountIt()
    const w = realm()
    const real = Document.prototype.querySelector.call(w.document, 'head') as HTMLElement
    for (const parent of [w.document.head, w.document.body]) {
      const s = w.document.createElement('script')
      parent.appendChild(s)
      expect(s.parentNode).toBe(real)
      const t = w.document.createElement('script')
      parent.insertBefore(t, null)
      expect(t.parentNode).toBe(real)
    }
    const div = w.document.body.insertBefore(w.document.createElement('div'), null)
    expect(div.parentNode).toBe(g.__ctx.portalContainer)
  })

  it('eventos de window e document vão para o host e saem no unmount', async () => {
    register('w', data(CARD))
    const { h } = await mountIt()
    const w = realm()
    const onResize = vi.fn()
    const onKey = vi.fn()
    const onCapture = vi.fn()
    const own = vi.fn()
    w.addEventListener('resize', onResize)
    w.document.addEventListener('keydown', onKey)
    w.addEventListener('scroll', onCapture, true)
    w.addEventListener('message', own)
    const ctrl = new AbortController()
    const onSignal = vi.fn()
    w.addEventListener('click', onSignal, { signal: ctrl.signal })
    window.dispatchEvent(new Event('resize'))
    document.dispatchEvent(new Event('keydown'))
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('click'))
    expect([onResize, onKey, onCapture, onSignal].map((f) => f.mock.calls.length)).toEqual([1, 1, 1, 1])
    // `message` é da janela do remote.
    window.dispatchEvent(new Event('message'))
    expect(own).not.toHaveBeenCalled()
    w.dispatchEvent(new Event('message'))
    expect(own).toHaveBeenCalledTimes(1)
    w.removeEventListener('message', own)
    w.dispatchEvent(new Event('message'))
    expect(own).toHaveBeenCalledTimes(1)
    ctrl.abort()
    w.removeEventListener('scroll', onCapture, true)
    window.dispatchEvent(new Event('click'))
    window.dispatchEvent(new Event('scroll'))
    expect([onSignal, onCapture].map((f) => f.mock.calls.length)).toEqual([1, 1])
    h.unmount()
    window.dispatchEvent(new Event('resize'))
    document.dispatchEvent(new Event('keydown'))
    expect([onResize, onKey].map((f) => f.mock.calls.length)).toEqual([1, 1])
  })

  it('tamanho da janela, matchMedia, HTMLElement e customElements vêm do host', async () => {
    register('w', data(CARD))
    await mountIt()
    const w = realm()
    expect(w.innerWidth).toBe(window.innerWidth)
    expect(w.devicePixelRatio).toBe(window.devicePixelRatio)
    expect(w.matchMedia('(min-width: 1px)').matches).toBe(window.matchMedia('(min-width: 1px)').matches)
    expect(w.HTMLElement).toBe(HTMLElement)
    expect(w.customElements).toBe(g.__ctx.customElements)
  })

  it('erro sem tratamento no iframe vai para o onError da montagem', async () => {
    register('w', data(CARD))
    const host = document.body.appendChild(document.createElement('div'))
    const onError = vi.fn()
    await mountRemote(host, 'w', { msg: 'x' }, { isolate: 'reframe', onError })
    const w = realm()
    w.dispatchEvent(Object.assign(new Event('error'), { error: new Error('quebrou') }))
    w.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: new Error('rejeitou') }))
    expect(onError.mock.calls.map(([e]) => [e.code, e.message.includes('quebrou') || e.message.includes('rejeitou')])).toEqual([
      ['RENDER_FAILED', true],
      ['RENDER_FAILED', true],
    ])
  })

  it('history.pushState do remote chega ao host', async () => {
    register('w', data(CARD))
    await mountIt()
    const w = realm()
    const pop = vi.fn()
    addEventListener('popstate', pop)
    // O happy-dom não troca a URL do iframe: o teste simula o que o navegador faz.
    const push = vi.spyOn(history, 'pushState')
    const href = new URL('/rota', location.href).href
    vi.spyOn(w, 'location', 'get').mockReturnValue({ href } as Location)
    w.history.pushState({ a: 1 }, '', '/rota')
    expect(push).toHaveBeenCalledWith({ a: 1 }, '', href)
    expect(pop).toHaveBeenCalled()
    removeEventListener('popstate', pop)
  })

  it('a navegação do host chega ao remote (popstate e hashchange)', async () => {
    register('w', data(CARD))
    // O happy-dom recusa trocar a URL do about:blank; no navegador ela é a da página.
    vi.spyOn(History.prototype, 'replaceState').mockImplementation(() => {})
    await mountIt()
    const w = realm()
    let at = 'about:blank#a'
    vi.spyOn(w, 'location', 'get').mockImplementation(() => ({ href: at }) as Location)
    const pop = vi.fn()
    const hash = vi.fn()
    w.addEventListener('popstate', pop)
    w.addEventListener('hashchange', hash)
    dispatchEvent(new PopStateEvent('popstate'))
    expect([pop.mock.calls.length, hash.mock.calls.length]).toEqual([1, 1])
    at = location.href
    dispatchEvent(new PopStateEvent('popstate'))
    expect(pop).toHaveBeenCalledTimes(1)
  })

  it('com integrity, confere os bytes e o iframe executa via blob:', async () => {
    const sri = 'sha384-' + createHash('sha384').update(CARD).digest('base64')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(CARD)))
    register('w', { url: 'https://cdn.empresa.com/w.js', integrity: sri })
    await mountIt('w', { msg: 'ok' })
    expect(imported).toEqual(['blob'])
    expect(g.__ctx.shadowRoot.querySelector('#msg').textContent).toBe('ok')
  })

  it('hash errado é INTEGRITY e nenhum iframe fica na página', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(CARD)))
    register('w', { url: 'https://cdn.empresa.com/w.js', integrity: 'sha384-AAAA' })
    const host = document.body.appendChild(document.createElement('div'))
    const onError = vi.fn()
    configure({ onError })
    expect((await fail(mountRemote(host, 'w', {}, { isolate: 'reframe' }))).code).toBe('INTEGRITY')
    expect(onError).toHaveBeenCalledTimes(1)
    expect(frame()).toBeNull()
    expect(imported).toEqual([])
  })

  it('partes de um remote (carrinho/Mini) e erros de formato', async () => {
    register('w', data(CARD))
    const { host } = await mountIt('w/Mini')
    expect(g.__ctx).toBeUndefined()
    expect(host.shadowRoot!.textContent).toContain('mini')
    const other = document.body.appendChild(document.createElement('div'))
    expect((await fail(mountRemote(other, 'w/Nada', {}, { isolate: 'reframe' }))).code).toBe('NOT_EXPOSED')
    register('vazio', data('export const x = 1'))
    expect((await fail(mountRemote(other, 'vazio', {}, { isolate: 'reframe' }))).code).toBe('INVALID_MODULE')
    register('quebra', data('throw new Error("top")'))
    expect((await fail(mountRemote(other, 'quebra', {}, { isolate: 'reframe' }))).code).toBe('LOAD_FAILED')
    register('lazy', data(`export default { mount() {} }; export const exposes = { './P': () => Promise.resolve({ default: { mount(el) { el.textContent = 'p'; return { unmount() {} } } } }) }`))
    await mountRemote(other, 'lazy/P', {}, { isolate: 'reframe' })
    expect(document.querySelectorAll('iframe[data-vitral-reframe]').length).toBe(2)
  })

  it('mount que lança remove o iframe', async () => {
    register('w', data('export default { mount() { throw new Error("x") } }'))
    const host = document.body.appendChild(document.createElement('div'))
    expect((await fail(mountRemote(host, 'w', {}, { isolate: 'reframe' }))).code).toBe('MOUNT_FAILED')
    expect(frame()).toBeNull()
  })

  it('remote local, não registrado e CSP sem o script do iframe', async () => {
    const host = document.body.appendChild(document.createElement('div'))
    register('local', { module: { mount: vi.fn() } })
    expect((await fail(mountRemote(host, 'local', {}, { isolate: 'reframe' }))).code).toBe('MOUNT_FAILED')
    expect((await fail(mountRemote(host, 'nada', {}, { isolate: 'reframe' }))).code).toBe('NOT_REGISTERED')
    csp = true
    register('w', data(CARD))
    const e = await fail(mountRemote(host, 'w', {}, { isolate: 'reframe' }))
    expect([e.code, e.message.includes('CSP')]).toEqual(['LOAD_FAILED', true])
    expect(frame()).toBeNull()
    await flush()
  })

  it('isolate="iframe" sem enableIframe() continua dando MOUNT_FAILED', async () => {
    register('w', data(CARD))
    const host = document.body.appendChild(document.createElement('div'))
    const e = await fail(mountRemote(host, 'w', {}, { isolate: 'iframe' }))
    expect([e.code, e.message.includes('enableIframe')]).toEqual(['MOUNT_FAILED', true])
  })

  it('o hash de CSP da documentação é o do script do iframe', () => {
    const doc = readFileSync(join(__dirname, '../../../docs/aprender/reframe.md'), 'utf8')
    expect(doc).toContain(`'sha256-${createHash('sha256').update(REFRAME_SCRIPT).digest('base64')}'`)
  })

  it('embed.js: reframe e iframe dão MOUNT_FAILED', () => {
    expect(() => embedLoad('w')).toThrow(/embed\.js/)
    expect(() => embedNoFrames(document.body, 'w')).toThrow(/embed\.js/)
  })
})
