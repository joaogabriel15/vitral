// @vitest-environment happy-dom
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configure, createSlot, loadModule, loadRemote, mountRemote, register, RemoteError, type RemoteContext } from '../src/index'
import { owner } from '../src/core/capture'
import { otelOnError } from '../src/otel'
import { sentryOnError } from '../src/sentry'
import { cleanup, flush, FIXTURE_REMOTE } from './helpers'

const THROWS = pathToFileURL(resolve(__dirname, 'fixtures/remote-throws.mjs')).href
const MANIFEST = 'https://cdn.exemplo.com/carrinho/vitral.json'
const FIXTURE_DIR = new URL('.', FIXTURE_REMOTE).href

/** Responde ao manifesto com `version` e o `entry` dado. */
function serve(entry = FIXTURE_REMOTE, version: string | undefined = '1.4.2') {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ name: 'carrinho', version, entry })))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

const host = () => document.body.appendChild(document.createElement('div'))
const rejection = (p: Promise<unknown>) => p.then(() => { throw new Error('deveria falhar') }, (e) => e as RemoteError)

let onError: ReturnType<typeof vi.fn>
beforeEach(() => {
  history.pushState({}, '', '/loja/carrinho')
  onError = vi.fn()
  configure({ allowedOrigins: ['*'], retries: 0, onError, remotes: { carrinho: MANIFEST } })
})
afterEach(cleanup)

describe('atribuição de erros', () => {
  it('erro de render vai ao onError global e ao da montagem, uma vez cada', async () => {
    const ctxs: RemoteContext[] = []
    register('local', { module: { mount: (_el: HTMLElement, _p: unknown, ctx: RemoteContext) => (ctxs.push(ctx), { unmount() {} }) } })
    const mine = vi.fn()
    const handle = await mountRemote(host(), 'local', {}, { onError: mine })
    ctxs[0].reportError(new Error('render'))
    handle.unmount()
    expect(mine).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toBe(mine.mock.calls[0][0])
    expect(onError.mock.calls[0][0]).toMatchObject({ code: 'RENDER_FAILED', remote: 'local', route: '/loja/carrinho' })
  })

  it('erro de render de um remote com manifesto traz remote, versão, entry e rota', async () => {
    serve()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ctx = await captureCtx()
    ctx.reportError('quebrou')
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toMatchObject({ remote: 'carrinho', version: '1.4.2', entry: FIXTURE_REMOTE, route: '/loja/carrinho' })
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('falha no download traz a URL registrada e a rota; o onError global recebe uma vez', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('não achei', { status: 404 })))
    const statuses: (RemoteError | null)[] = []
    createSlot(host(), { name: 'carrinho', onStatus: (_s, e) => statuses.push(e) })
    await flush()
    const err = statuses.at(-1)!
    expect(err).toMatchObject({ code: 'LOAD_FAILED', remote: 'carrinho', entry: MANIFEST, route: '/loja/carrinho' })
    expect(err.version).toBeUndefined()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toBe(err)
  })

  it('falha ao importar o JS leva a versão do manifesto', async () => {
    serve('https://cdn.exemplo.com/carrinho/nao-existe.js')
    const e = await rejection(loadRemote('carrinho'))
    expect(e).toMatchObject({ code: 'LOAD_FAILED', version: '1.4.2', entry: 'https://cdn.exemplo.com/carrinho/nao-existe.js' })
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('erro no mount vira MOUNT_FAILED com versão, e o onError global recebe uma vez', async () => {
    serve(THROWS)
    const e = await rejection(mountRemote(host(), 'carrinho', {}))
    expect(e).toMatchObject({ code: 'MOUNT_FAILED', remote: 'carrinho', version: '1.4.2', entry: THROWS, route: '/loja/carrinho' })
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toBe(e)
  })

  it('isolate iframe sem enableIframe, módulo sem mount e parte não exposta também vão ao onError', async () => {
    register('sem-mount', { module: { nada: 1 } as never })
    await rejection(mountRemote(host(), 'carrinho', {}, { isolate: 'iframe' }))
    await rejection(loadRemote('sem-mount'))
    serve()
    await rejection(loadModule('carrinho/naoExiste'))
    expect(onError.mock.calls.map(([e]) => e.code)).toEqual(['MOUNT_FAILED', 'INVALID_MODULE', 'NOT_EXPOSED'])
    expect(onError.mock.calls[0][0].entry).toBe(MANIFEST)
  })

  it('um onError global que lança não quebra o fluxo', async () => {
    configure({ onError: () => { throw new Error('monitoramento fora') } })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
    expect((await rejection(loadRemote('carrinho'))).code).toBe('LOAD_FAILED')
  })
})

describe('captureGlobalErrors', () => {
  const thrown = (file = FIXTURE_REMOTE) => Object.assign(new Error('estourou'), { stack: `Error: estourou\n    at clique (${file}:3:9)` })

  it('erro sem tratamento do arquivo de um remote montado vai ao onError, atribuído a ele', async () => {
    serve()
    configure({ captureGlobalErrors: true })
    await flush()
    const h = await mountRemote(host(), 'carrinho', {})
    dispatchEvent(new ErrorEvent('error', { error: thrown(), filename: FIXTURE_REMOTE }))
    const reason = thrown()
    dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason }))
    expect(onError).toHaveBeenCalledTimes(2)
    expect(onError.mock.calls[1][0]).toMatchObject({ code: 'RENDER_FAILED', remote: 'carrinho', version: '1.4.2', entry: FIXTURE_REMOTE, cause: reason })
    // Erro do host, sem URL, já entregue, ou RemoteError: nada.
    dispatchEvent(new ErrorEvent('error', { error: thrown('https://host.exemplo.com/assets/app.js') }))
    dispatchEvent(new ErrorEvent('error', { error: 'texto' }))
    dispatchEvent(new ErrorEvent('error', { error: new RemoteError('TIMEOUT', 'carrinho', 'lento') }))
    expect(onError).toHaveBeenCalledTimes(2)
    // Desligado: nada.
    configure({ captureGlobalErrors: false })
    dispatchEvent(new ErrorEvent('error', { error: thrown() }))
    expect(onError).toHaveBeenCalledTimes(2)
    h.unmount()
  })

  it('erro já entregue com reportError não é contado de novo', async () => {
    const ctxs: RemoteContext[] = []
    register('ok', { module: { mount: (_el: HTMLElement, _p: unknown, ctx: RemoteContext) => (ctxs.push(ctx), { unmount() {} }) } })
    serve()
    configure({ captureGlobalErrors: true })
    await flush()
    const h = await mountRemote(host(), 'carrinho', {})
    const k = await mountRemote(host(), 'ok', {}, { onError() {} })
    const err = thrown()
    ctxs[0].reportError(err)
    dispatchEvent(new ErrorEvent('error', { error: err }))
    expect(onError).toHaveBeenCalledTimes(1)
    h.unmount()
    k.unmount()
  })

  it('owner: prefere o diretório mais longo e ignora diretórios com scripts do host', async () => {
    serve()
    const h = await mountRemote(host(), 'carrinho', {})
    expect(owner(thrown())).toBe('carrinho')
    expect(owner(thrown(), `${FIXTURE_DIR}outro.js`)).toBe('carrinho')
    expect(owner(new Error('sem pilha'), '')).toBeUndefined()
    const link = document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'modulepreload', href: `${FIXTURE_DIR}host.js` }))
    expect(owner(thrown())).toBeUndefined()
    link.remove()
    h.unmount()
    expect(owner(thrown())).toBeUndefined()
  })
})

describe('adaptadores', () => {
  const err = () => Object.assign(new RemoteError('RENDER_FAILED', 'carrinho', 'quebrou'), { version: '1.4.2', entry: 'https://cdn/x.js', route: '/loja' })

  it('sentryOnError chama captureException com as tags do vitral', () => {
    const Sentry = { captureException: vi.fn() }
    const e = err()
    sentryOnError(Sentry)(e)
    expect(Sentry.captureException).toHaveBeenCalledWith(e, {
      tags: { 'vitral.remote': 'carrinho', 'vitral.version': '1.4.2', 'vitral.code': 'RENDER_FAILED' },
      extra: { entry: 'https://cdn/x.js', route: '/loja', docs: e.docs },
    })
    sentryOnError(Sentry)(new RemoteError('TIMEOUT', 'menu', 'lento'))
    expect(Sentry.captureException.mock.calls[1][1].tags).toEqual({ 'vitral.remote': 'menu', 'vitral.code': 'TIMEOUT' })
  })

  it('otelOnError põe um evento exception no span ativo', () => {
    const span = { addEvent: vi.fn(), recordException: vi.fn(), setStatus: vi.fn(), end: vi.fn() }
    const tracer = { startSpan: vi.fn() }
    otelOnError({ trace: { getActiveSpan: () => span }, tracer })(err())
    expect(tracer.startSpan).not.toHaveBeenCalled()
    expect(span.addEvent).toHaveBeenCalledWith('exception', expect.objectContaining({
      'exception.type': 'RemoteError',
      'vitral.remote': 'carrinho',
      'vitral.version': '1.4.2',
      'vitral.code': 'RENDER_FAILED',
      'vitral.entry': 'https://cdn/x.js',
      'vitral.route': '/loja',
    }))
    expect(span.end).not.toHaveBeenCalled()
  })

  it('otelOnError sem span ativo abre um span vitral.error pelo tracer', () => {
    const span = { addEvent: vi.fn(), recordException: vi.fn(), setStatus: vi.fn(), end: vi.fn() }
    const tracer = { startSpan: vi.fn(() => span) }
    const e = new RemoteError('TIMEOUT', 'menu', 'lento')
    otelOnError({ trace: { getActiveSpan: () => undefined }, tracer })(e)
    const attributes = tracer.startSpan.mock.calls[0][1].attributes
    expect(tracer.startSpan.mock.calls[0][0]).toBe('vitral.error')
    expect(attributes).toMatchObject({ 'vitral.remote': 'menu', 'vitral.code': 'TIMEOUT' })
    expect('vitral.version' in attributes).toBe(false)
    expect(span.recordException).toHaveBeenCalledWith(e)
    expect(span.setStatus).toHaveBeenCalledWith({ code: 2, message: e.message })
    expect(span.end).toHaveBeenCalled()
    // Sem trace nem tracer: não faz nada.
    expect(() => otelOnError({})(e)).not.toThrow()
  })
})

/** Contexto da última montagem de `carrinho`, pelo módulo em cache. */
async function captureCtx(): Promise<RemoteContext> {
  const mod = await loadRemote('carrinho')
  const ctxs: RemoteContext[] = []
  const original = mod.mount
  mod.mount = (el, p, ctx) => (ctxs.push(ctx), original(el, p, ctx))
  const h = await mountRemote(host(), 'carrinho', {})
  mod.mount = original
  h.unmount()
  return ctxs[0]
}
