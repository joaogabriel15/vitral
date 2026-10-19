// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { __reset, configure, mountRemote, register, type RemoteContext } from '../src/index'
import { injectCss } from '../src/core/css'

afterEach(() => {
  __reset()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.head.replaceChildren()
  document.body.replaceChildren()
})

const remote = { mount: (_el: HTMLElement, _p: unknown, _ctx: RemoteContext) => ({ unmount() {} }) }
let n = 0
// URLs próprias por teste: o cache de CSS vale para a página toda.
const url = () => `https://cdn.empresa.com/r${++n}.css`

async function mountShadow(css: string) {
  register(`x${n}`, { module: remote, css: [css], isolate: 'shadow' })
  const host = document.body.appendChild(document.createElement('div'))
  const handle = await mountRemote(host, `x${n}`, {}, { styles: { mirrorTheme: false } })
  return { root: host.shadowRoot!, handle }
}

describe('CSS que falha não fica preso no cache', () => {
  it('Shadow DOM: depois de um 503, a próxima montagem baixa de novo', async () => {
    const css = url()
    const fetch = vi.fn(async () => new Response('.a { color: red }'))
    fetch.mockResolvedValueOnce(new Response('', { status: 503 }))
    vi.stubGlobal('fetch', fetch)

    const first = await mountShadow(css)
    expect(first.root.adoptedStyleSheets).toHaveLength(0)
    first.handle.unmount()

    const second = await mountShadow(css)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(second.root.adoptedStyleSheets).toHaveLength(1)
  })

  it('Shadow DOM: montagens ao mesmo tempo baixam o CSS uma vez só', async () => {
    const css = url()
    const fetch = vi.fn(async () => new Response('.a {}'))
    vi.stubGlobal('fetch', fetch)
    register('a', { module: remote, css: [css], isolate: 'shadow' })
    const hosts = [0, 1].map(() => document.body.appendChild(document.createElement('div')))
    await Promise.all(hosts.map((h) => mountRemote(h, 'a', {})))
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('<link>: no erro o link sai e a próxima chamada cria outro', async () => {
    const css = url()
    const first = injectCss([css], null)
    const broken = document.head.querySelector<HTMLLinkElement>(`link[href="${css}"]`)!
    broken.dispatchEvent(new Event('error'))
    await first
    expect(broken.isConnected).toBe(false)

    const again = injectCss([css], null)
    const link = document.head.querySelector<HTMLLinkElement>(`link[href="${css}"]`)!
    expect(link).not.toBe(broken)
    link.dispatchEvent(new Event('load'))
    await again
  })

  it('<link>: carregado com sucesso, não cria outro', async () => {
    const css = url()
    const first = injectCss([css], null)
    document.head.querySelector<HTMLLinkElement>(`link[href="${css}"]`)!.dispatchEvent(new Event('load'))
    await first
    await injectCss([css], null)
    expect(document.head.querySelectorAll(`link[href="${css}"]`)).toHaveLength(1)
  })
})

describe('timeout vale para o CSS', () => {
  it('<link> que nunca responde não segura a montagem além do timeout', async () => {
    vi.useFakeTimers()
    configure({ timeout: 100 })
    const css = url()
    register('lento', { module: remote, css: [css] })
    const host = document.body.appendChild(document.createElement('div'))
    let done = false
    const p = mountRemote(host, 'lento', {}).then(() => (done = true))
    await vi.advanceTimersByTimeAsync(99)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await p
    expect(done).toBe(true)
  })

  it('Shadow DOM: fetch que nunca responde é abortado no timeout e a montagem segue', async () => {
    vi.useFakeTimers()
    configure({ timeout: 100 })
    let signal: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((_u: string, init: RequestInit) => {
        signal = init.signal!
        return new Promise<Response>(() => {})
      }),
    )
    const css = url()
    const p = mountShadow(css)
    await vi.advanceTimersByTimeAsync(100)
    const { root } = await p
    expect(signal!.aborted).toBe(true)
    expect(root.adoptedStyleSheets).toHaveLength(0)
  })
})
