// @vitest-environment happy-dom
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configure, events, mountRemote, register, RemoteError, type MountOptions } from '../src/index'
import { enableIframe, FRAME_SCRIPT, type FrameBridge } from '../src/iframe'
import { FRAME_HTML, FRAME_RUNTIME } from '../src/iframe-frame'
import { setFrameMounter } from '../src/core/mount'
import { cleanup, flush } from './helpers'

/**
 * O happy-dom não roda scripts de iframe. Aqui o mesmo código do iframe
 * (FRAME_RUNTIME) roda contra uma janela falsa com documento próprio, ligada
 * à página por postMessage com clonagem de verdade (structuredClone).
 */
type Frame = { doc: Document; imported: string[]; post(type: string, data?: unknown): void; seen: Array<{ type: string; data: any }> }

function connect(iframe: HTMLIFrameElement): Frame {
  const cw = iframe.contentWindow as any
  const listeners: Array<(e: unknown) => void> = []
  const doc = document.implementation.createHTMLDocument('')
  const imported: string[] = []
  const seen: Frame['seen'] = []
  const parent = {
    postMessage(data: unknown) {
      const e = Object.assign(new Event('message'), { data: structuredClone(data), source: cw })
      queueMicrotask(() => dispatchEvent(e))
    },
  }
  const w = {
    parent,
    document: doc,
    console,
    Blob,
    URL: { createObjectURL: (b: Blob & { text?: never }) => b },
    addEventListener: (_: string, fn: (e: unknown) => void) => listeners.push(fn),
  }
  cw.postMessage = (data: any) => {
    const copy = structuredClone(data)
    seen.push({ type: copy.type, data: copy.data })
    queueMicrotask(() => listeners.forEach((fn) => fn({ source: parent, data: copy })))
  }
  const load = async (u: string | Blob) => {
    const url = typeof u === 'string' ? u : `data:text/javascript,${encodeURIComponent(await u.text())}`
    imported.push(typeof u === 'string' ? u : 'blob')
    return import(/* @vite-ignore */ url)
  }
  new Function(`return ${FRAME_RUNTIME}`)()(w, load)
  return { doc, imported, seen, post: (type, data) => parent.postMessage({ vitral: 1, type, data }) }
}

const data = (code: string) => `data:text/javascript,${encodeURIComponent(code)}`
const CARD = `export default { mount(el, p, ctx) {
  el.innerHTML = '<p>' + p.msg + '</p>'
  globalThis.__ctx = ctx
  return { update(n) { el.innerHTML = '<p>' + n.msg + '</p>' }, unmount() { globalThis.__unmounted = true } }
} }
export const exposes = { './Mini': { default: { mount(el) { el.textContent = 'mini'; return { unmount() {} } } } }, './api': { x: 1 } }`

async function mountFramed(name: string, props: Record<string, unknown> = {}, options: MountOptions = {}) {
  const host = document.body.appendChild(document.createElement('div'))
  const p = mountRemote(host, name, props, { isolate: 'iframe', ...options })
  let frame: Frame | null = null
  for (let i = 0; i < 50 && !frame; i++) {
    await new Promise((r) => setTimeout(r, 0))
    const el = host.querySelector('iframe')
    if (el) frame = connect(el)
  }
  return { host, frame: frame!, handle: p }
}

const fail = (p: Promise<unknown>) => p.then(() => { throw new Error('deveria falhar') }, (e) => e as RemoteError)
const g = globalThis as any

beforeEach(() => {
  enableIframe()
  configure({ allowedOrigins: ['*'] })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete g.__ctx
  delete g.__unmounted
})

describe('isolate="iframe"', () => {
  it('monta dentro de um iframe com sandbox, atualiza props e desmonta', async () => {
    register('w', data(CARD))
    const { host, frame, handle } = await mountFramed('w', { msg: 'oi' })
    const h = await handle
    const iframe = host.querySelector('iframe')!
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts')
    expect(iframe.getAttribute('srcdoc')).toBe(FRAME_HTML)
    expect(FRAME_HTML).toContain(FRAME_SCRIPT)
    expect(iframe.title).toBe('w')
    expect(frame.doc.body.textContent).toBe('oi')
    expect(host.querySelector('p')).toBeNull()
    expect(g.__ctx.shadowRoot).toBeNull()
    expect(g.__ctx.name).toBe('w')
    h.update({ msg: 'tchau' })
    await flush()
    expect(frame.doc.body.textContent).toBe('tchau')
    h.unmount()
    expect(host.querySelector('iframe')).toBeNull()
  })

  it('decide antes de baixar: o JS nunca roda na página', async () => {
    const mount = vi.fn()
    register('w', { url: data(CARD), isolate: 'iframe' })
    register('local', { module: { mount } })
    const host = document.body.appendChild(document.createElement('div'))
    const p = mountRemote(host, 'w', { msg: 'x' })
    await flush()
    const frame = connect(host.querySelector('iframe')!)
    await p
    expect(frame.imported).toEqual([data(CARD)])
    // Remote local já está na página: não dá para isolar.
    const e = await fail(mountRemote(host, 'local', {}, { isolate: 'iframe' }))
    expect(e.code).toBe('MOUNT_FAILED')
    expect(mount).not.toHaveBeenCalled()
  })

  it('com integrity, a página confere o hash e o iframe recebe os bytes', async () => {
    const sri = 'sha384-' + createHash('sha384').update(CARD).digest('base64')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(CARD)))
    register('w', { url: 'https://cdn.empresa.com/w.js', integrity: sri })
    const { frame, handle } = await mountFramed('w', { msg: 'ok' })
    await handle
    expect(frame.imported).toEqual(['blob'])
    expect(frame.seen[0].data.code).toBeInstanceOf(ArrayBuffer)
    expect(frame.doc.body.textContent).toBe('ok')
  })

  it('hash errado é INTEGRITY e nenhum iframe é criado', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(CARD)))
    configure({ retries: 0 })
    register('w', { url: 'https://cdn.empresa.com/w.js', integrity: 'sha384-AAAA' })
    const host = document.body.appendChild(document.createElement('div'))
    expect((await fail(mountRemote(host, 'w', {}, { isolate: 'iframe' }))).code).toBe('INTEGRITY')
    expect(host.querySelector('iframe')).toBeNull()
  })

  it('respeita a allowlist', async () => {
    configure({ allowedOrigins: ['https://cdn.empresa.com'] })
    register('w', 'https://malicioso.com/w.js')
    expect((await fail(mountRemote(document.body, 'w', {}, { isolate: 'iframe' }))).code).toBe('ORIGIN_BLOCKED')
  })

  it('monta partes expostas e traduz os erros do iframe', async () => {
    register('w', data(CARD))
    const a = await mountFramed('w/Mini')
    await a.handle
    expect(a.frame.doc.body.textContent).toBe('mini')
    const b = await mountFramed('w/Nada')
    expect((await fail(b.handle)).code).toBe('NOT_EXPOSED')
    const c = await mountFramed('w/api')
    expect((await fail(c.handle)).code).toBe('INVALID_MODULE')
    register('quebra', data('export default { mount() { throw new Error("boom") } }'))
    const d = await mountFramed('quebra')
    const e = await fail(d.handle)
    expect(e.code).toBe('MOUNT_FAILED')
    expect(e.message).toContain('boom')
    expect(d.host.querySelector('iframe')).toBeNull()
  })

  it('erro ao importar no iframe é LOAD_FAILED', async () => {
    register('w', data('throw new Error("quebrou")'))
    const { handle } = await mountFramed('w')
    expect((await fail(handle)).code).toBe('LOAD_FAILED')
  })

  it('ponte de eventos nos dois sentidos, com last() e limpeza no unmount', async () => {
    register('w', data(CARD))
    events.emit('tema', 'escuro')
    const { frame, handle } = await mountFramed('w', { msg: '' })
    const h = await handle
    const ctx = g.__ctx
    const got: unknown[] = []
    const off = ctx.events.on('tema', (v: unknown) => got.push(v))
    ctx.events.on('tema', () => {})
    await flush()
    expect(ctx.events.last('tema')).toBe('escuro')
    events.emit('tema', 'claro')
    await flush()
    expect(got).toEqual(['claro'])
    off()
    events.emit('tema', 'azul')
    await flush()
    expect(got).toEqual(['claro'])
    expect(ctx.events.last('tema')).toBe('azul')
    // Uma assinatura por tipo na página, não importa quantos handlers no iframe.
    expect(frame.seen.filter((m) => m.type === 'last')).toHaveLength(1)

    const host: unknown[] = []
    events.on('ping', (v) => host.push(v))
    ctx.events.emit('ping', { de: 'iframe' })
    await flush()
    expect(host).toEqual([{ de: 'iframe' }])

    h.unmount()
    const before = frame.seen.length
    events.emit('tema', 'verde')
    await flush()
    expect(frame.seen.length).toBe(before)
  })

  it('handler com erro no iframe não derruba os outros', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    register('w', data(CARD))
    const { handle } = await mountFramed('w', { msg: '' })
    await handle
    const ok = vi.fn()
    g.__ctx.events.on('x', () => { throw new Error('x') })
    g.__ctx.events.on('x', ok)
    await flush()
    events.emit('x', 1)
    await flush()
    expect(ok).toHaveBeenCalledWith(1)
    expect(err).toHaveBeenCalled()
  })

  it('navigate só dentro da mesma origem', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    register('w', data(CARD))
    const { handle } = await mountFramed('w', { msg: '' })
    await handle
    g.__ctx.navigate('/pedidos/1')
    await flush()
    expect(location.pathname).toBe('/pedidos/1')
    g.__ctx.navigate('https://malicioso.com/x')
    await flush()
    expect(location.host).not.toBe('malicioso.com')
    expect(warn).toHaveBeenCalled()
    history.replaceState(null, '', '/')
  })

  it('reportError vai para onError como RENDER_FAILED', async () => {
    register('w', data(CARD))
    const onError = vi.fn()
    const { handle } = await mountFramed('w', { msg: '' }, { onError })
    await handle
    g.__ctx.reportError(new Error('render'))
    await flush()
    expect(onError.mock.calls[0][0].code).toBe('RENDER_FAILED')
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const b = await mountFramed('w', { msg: '' })
    await b.handle
    g.__ctx.reportError('sem handler')
    await flush()
    expect(err).toHaveBeenCalled()
  })

  it('altura do iframe acompanha a mensagem size e ignora mensagens de outras janelas', async () => {
    register('w', data(CARD))
    const { host, frame, handle } = await mountFramed('w', { msg: '' })
    await handle
    frame.post('size', { height: 120.4 })
    await flush()
    expect(host.querySelector('iframe')!.style.height).toBe('120.4px')
    dispatchEvent(Object.assign(new Event('message'), { data: { vitral: 1, type: 'size', data: { height: 9 } }, source: window }))
    frame.post('size', { height: 'x' })
    await flush()
    expect(host.querySelector('iframe')!.style.height).toBe('0px')
  })

  it('props que não são serializáveis viram JSON, com aviso', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    register('w', data(CARD))
    const { frame, handle } = await mountFramed('w', { msg: 'a', fn: () => 1 })
    await handle
    expect(frame.doc.body.textContent).toBe('a')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('sem resposta do iframe é TIMEOUT e o iframe sai', async () => {
    configure({ timeout: 30 })
    register('w', data(CARD))
    const host = document.body.appendChild(document.createElement('div'))
    const e = await fail(mountRemote(host, 'w', {}, { isolate: 'iframe' }))
    expect(e.code).toBe('TIMEOUT')
    expect(host.querySelector('iframe')).toBeNull()
  })

  it('pontes extras recebem um canal com o iframe', async () => {
    const got: unknown[] = []
    const dispose = vi.fn()
    const bridge: FrameBridge = (port, info) => {
      port.on('shared:get', (d) => {
        got.push([info.name, d])
        port.post('shared:value', 42)
      })
      return dispose
    }
    enableIframe({ bridges: [bridge] })
    register('w', data(CARD))
    const { frame, handle } = await mountFramed('w', { msg: '' })
    const h = await handle
    frame.post('shared:get', 'usuario')
    await flush()
    expect(got).toEqual([['w', 'usuario']])
    expect(frame.seen.at(-1)).toEqual({ type: 'shared:value', data: 42 })
    h.unmount()
    expect(dispose).toHaveBeenCalled()
  })

  it('avisa quando o sandbox deixa de isolar', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    enableIframe({ sandbox: 'allow-scripts allow-same-origin' })
    expect(warn).toHaveBeenCalled()
  })

  it('remote não registrado é NOT_REGISTERED', async () => {
    expect((await fail(mountRemote(document.body, 'nada', {}, { isolate: 'iframe' }))).code).toBe('NOT_REGISTERED')
  })

  it('sem enableIframe o erro diz o que importar', async () => {
    setFrameMounter(undefined as never)
    register('w', data(CARD))
    const e = await fail(mountRemote(document.body, 'w', {}, { isolate: 'iframe' }))
    expect(e.code).toBe('MOUNT_FAILED')
    expect(e.message).toContain('enableIframe')
  })
})
