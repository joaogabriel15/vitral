// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { __reset, configure, createSlot, mountRemote, register, type RemoteContext } from '../src/index'

afterEach(() => {
  __reset()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
  document.documentElement.removeAttribute('class')
  document.documentElement.removeAttribute('data-theme')
})

const remote = { mount: (_el: HTMLElement, _p: unknown, _ctx: RemoteContext) => ({ unmount() {} }) }
let n = 0
// Cada teste usa URLs próprias: o cache de folhas vale para a página toda.
const cdn = (path: string) => `https://cdn${n}.empresa.com/${path}`
const files = (map: Record<string, string>) => {
  n++
  const fetch = vi.fn(async (url: string) => {
    const body = map[url.replace(`https://cdn${n}.empresa.com/`, '')]
    return body === undefined ? new Response('', { status: 404 }) : new Response(body)
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
const text = (s: CSSStyleSheet) => [...s.cssRules].map((r) => r.cssText).join('\n')
const hoisted = () => [...document.head.querySelectorAll('style[data-vitral-properties]')].map((s) => s.textContent).join('\n')

async function mount(name: string, css: string[], options: Parameters<typeof mountRemote>[3] = {}) {
  register(name, { module: remote, css, isolate: 'shadow' })
  const host = document.body.appendChild(document.createElement('div'))
  const handle = await mountRemote(host, name, {}, options)
  return { host, handle, root: host.shadowRoot!, el: host.shadowRoot!.querySelector<HTMLElement>('[data-vitral-root]')! }
}

describe('fontes e @import no Shadow DOM', () => {
  it('@font-face sobe para o documento uma vez só, com a URL do remote', async () => {
    const face = '@font-face { font-family: Remota; src: url(fonts/r.woff2) }'
    files({ 'a.css': `${face} .a { font-family: Remota }`, 'b.css': face })
    const { root } = await mount('x', [cdn('a.css'), cdn('b.css')])
    expect(root.adoptedStyleSheets.map(text).join('\n')).not.toContain('@font-face')
    const up = hoisted()
    expect(up.match(/font-family: Remota; src/g)).toHaveLength(1)
    expect(up).toContain(`url(${cdn('fonts/r.woff2')})`)
  })

  it('URL só com o caminho vale a partir do CSS do remote, não da página', async () => {
    files({ 'css/a.css': '@font-face { font-family: Raiz; src: url("/f/r.woff2") } .a { background-image: url(//img.com/a.png) }' })
    const { root } = await mount('x', [cdn('css/a.css')])
    expect(hoisted()).toContain(`url("${cdn('f/r.woff2')}")`)
    expect(text(root.adoptedStyleSheets[0])).toContain('url("//img.com/a.png")')
  })

  it('@import vira outra folha adotada antes da que importa', async () => {
    const fetch = files({
      'main.css': '@import "fontes.css?family=A:wght@400;700&x=1"; @import url(base/b.css) screen; @import url(/raiz.css); .main { color: red }',
      'fontes.css?family=A:wght@400;700&x=1': '@font-face { font-family: A; src: url(a.woff2) } .fontes { color: blue }',
      'base/b.css': '.b { color: green }',
      'raiz.css': '.raiz { color: gray }',
    })
    const { root } = await mount('x', [cdn('main.css')])
    expect(root.adoptedStyleSheets.map(text)).toEqual([
      expect.stringContaining('.fontes'),
      expect.stringContaining('.b'),
      expect.stringContaining('.raiz'),
      expect.stringContaining('.main'),
    ])
    expect(text(root.adoptedStyleSheets[3])).not.toContain('@import')
    expect(hoisted()).toContain(`url(${cdn('a.woff2')})`)
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('@import em ciclo não trava a montagem', async () => {
    files({ 'a.css': '@import "b.css"; .a { color: red }', 'b.css': '@import "a.css"; .b { color: blue }' })
    const { root } = await mount('x', [cdn('a.css')])
    expect(root.adoptedStyleSheets.map(text)).toEqual([expect.stringContaining('.b'), expect.stringContaining('.a')])
  })
})

describe('CSS base do host no Shadow DOM', () => {
  it('configure({ styles: { inherit } }) adota o mesmo CSSStyleSheet em todos os shadow roots, antes do CSS do remote', async () => {
    const fetch = files({ 'base.css': '.base { color: red }', 'r.css': '.r { color: blue }', 'extra.css': '.extra { color: green }' })
    configure({ styles: { inherit: [cdn('base.css')] } })
    const a = await mount('a', [cdn('r.css')])
    const b = await mount('b', [cdn('r.css')], { styles: { inherit: [cdn('extra.css')] } })
    expect(a.root.adoptedStyleSheets.map(text)).toEqual(['.base { color: red; }', '.r { color: blue; }'])
    expect(b.root.adoptedStyleSheets.map(text)).toEqual(['.base { color: red; }', '.extra { color: green; }', '.r { color: blue; }'])
    expect(b.root.adoptedStyleSheets[0]).toBe(a.root.adoptedStyleSheets[0])
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('URL relativa vale a partir da página', async () => {
    const fetch = files({})
    configure({ styles: { inherit: ['/assets/base.css'] } })
    await mount('a', [])
    expect(fetch).toHaveBeenCalledWith(new URL('/assets/base.css', document.baseURI).href, expect.anything())
  })

  it('sem folhas construídas, cai para <link> dentro do shadow root', async () => {
    vi.stubGlobal('CSSStyleSheet', undefined)
    configure({ styles: { inherit: ['https://x.com/base.css'] } })
    register('x', { module: remote, css: ['https://x.com/r.css'], isolate: 'shadow' })
    const host = document.body.appendChild(document.createElement('div'))
    const mounting = mountRemote(host, 'x', {})
    await vi.waitFor(() => expect(host.shadowRoot!.querySelectorAll('link')).toHaveLength(2))
    const links = [...host.shadowRoot!.querySelectorAll('link')]
    expect(links.map((l) => l.href)).toEqual(['https://x.com/base.css', 'https://x.com/r.css'])
    links.forEach((l) => l.dispatchEvent(new Event('load')))
    await mounting
  })

  it('não vale no modo escopo', async () => {
    const fetch = files({})
    configure({ styles: { inherit: ['/base.css'] } })
    document.documentElement.className = 'dark'
    register('x', { module: remote })
    const host = document.body.appendChild(document.createElement('div'))
    await mountRemote(host, 'x', {})
    expect(fetch).not.toHaveBeenCalled()
    expect(host.querySelector('[data-vitral-root]')!.className).toBe('')
  })
})

describe('mirrorTheme', () => {
  const tick = () => new Promise((r) => setTimeout(r, 0))

  it('copia class e data-theme do <html> para a raiz do remote e acompanha as mudanças', async () => {
    files({})
    document.documentElement.className = 'dark tema-a'
    document.documentElement.setAttribute('data-theme', 'roxo')
    const { el, handle } = await mount('x', [])
    el.classList.add('do-remote')
    expect(el.className).toBe('dark tema-a do-remote')
    expect(el.getAttribute('data-theme')).toBe('roxo')

    document.documentElement.className = 'tema-b'
    document.documentElement.removeAttribute('data-theme')
    await tick()
    expect(el.className).toBe('do-remote tema-b')
    expect(el.hasAttribute('data-theme')).toBe(false)

    // Classe que o remote já tinha não é removida.
    document.documentElement.className = 'do-remote'
    await tick()
    document.documentElement.className = ''
    await tick()
    expect(el.className).toBe('do-remote')

    handle.unmount()
    document.documentElement.className = 'dark'
    await tick()
    expect(el.className).toBe('do-remote')
  })

  it('desligado no configure ou na montagem', async () => {
    files({})
    document.documentElement.className = 'dark'
    configure({ styles: { mirrorTheme: false } })
    expect((await mount('a', [])).el.className).toBe('')
    configure({ styles: {} })
    expect((await mount('b', [], { styles: { mirrorTheme: false } })).el.className).toBe('')
    expect((await mount('c', [])).el.className).toBe('dark')
  })

  it('para de observar se o mount do remote falha', async () => {
    files({})
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
    register('x', { module: { mount: () => { throw new Error('boom') } }, isolate: 'shadow' })
    const host = document.body.appendChild(document.createElement('div'))
    await expect(mountRemote(host, 'x', {})).rejects.toMatchObject({ code: 'MOUNT_FAILED' })
    expect(disconnect).toHaveBeenCalled()
    disconnect.mockRestore()
  })

  it('createSlot repassa styles', async () => {
    files({ 'base.css': '.base { color: red }' })
    register('x', { module: remote, isolate: 'shadow' })
    const target = document.body.appendChild(document.createElement('div'))
    await new Promise<void>((resolve) =>
      createSlot(target, { name: 'x', styles: { inherit: [cdn('base.css')] }, onStatus: (s) => s === 'ready' && resolve() }),
    )
    expect(target.querySelector('[data-vitral-slot]')!.shadowRoot!.adoptedStyleSheets.map(text)).toEqual(['.base { color: red; }'])
  })
})
