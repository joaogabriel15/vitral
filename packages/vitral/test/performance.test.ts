// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { __reset, configure, mountRemote, preload, register } from '../src/index'
import { flush } from './helpers'

afterEach(() => {
  __reset()
  vi.unstubAllGlobals()
  document.head.replaceChildren()
  document.body.replaceChildren()
})

const CDN = 'https://cdn.empresa.com/carrinho'

/**
 * fetch falso: devolve o manifesto e o CSS; o JS fica pendente até
 * `releaseJs()`. Cada teste usa um CSS próprio, porque o texto do CSS fica em
 * cache no módulo.
 */
function network(css = 'remote-1.css') {
  // Hash em base64url: vai direto para o caminho do blob:, que usa fetch (o
  // vitest buscaria o import() de https: pelo fetch falso e ficaria pendente).
  const manifest = { name: 'carrinho', entry: 'remote-1.js', css: [css], integrity: 'sha384-AA_A' }
  let releaseJs = () => {}
  const calls: string[] = []
  const fetch = vi.fn((url: string) => {
    calls.push(url)
    if (url.endsWith('.json')) return Promise.resolve(new Response(JSON.stringify(manifest)))
    if (url.endsWith('.css')) return Promise.resolve(new Response('.a { color: red }'))
    return new Promise<Response>((resolve) => (releaseJs = () => resolve(new Response('codigo'))))
  })
  vi.stubGlobal('fetch', fetch)
  return { calls, releaseJs: () => releaseJs() }
}

describe('downloads em paralelo', () => {
  it('fora do Shadow DOM, o CSS começa (preload) antes de o JS terminar', async () => {
    const net = network()
    configure({ retries: 0 })
    register('carrinho', `${CDN}/vitral.json`)
    const mounting = mountRemote(document.body.appendChild(document.createElement('div')), 'carrinho', {}).catch((e) => e)
    await flush()
    const link = document.head.querySelector<HTMLLinkElement>(`link[rel="preload"][href="${CDN}/remote-1.css"]`)
    expect(link?.as).toBe('style')
    expect(link?.crossOrigin).toBe('anonymous')
    expect(net.calls).toContain(`${CDN}/remote-1.js`)
    net.releaseJs()
    await mounting
  })

  it('no Shadow DOM, o CSS é baixado junto com o JS', async () => {
    const net = network('shadow.css')
    configure({ retries: 0 })
    register('carrinho', `${CDN}/vitral.json`)
    const mounting = mountRemote(document.body.appendChild(document.createElement('div')), 'carrinho', {}, { isolate: 'shadow' }).catch((e) => e)
    await flush()
    expect(net.calls).toEqual([`${CDN}/vitral.json`, `${CDN}/shadow.css`, `${CDN}/remote-1.js`])
    expect(document.head.querySelector('link[rel="preload"]')).toBeNull()
    net.releaseJs()
    await mounting
  })

  it('preload() também baixa o CSS, uma vez só', async () => {
    const net = network()
    register('carrinho', `${CDN}/vitral.json`)
    preload('carrinho')
    preload('carrinho')
    await flush()
    expect(document.head.querySelectorAll(`link[rel="preload"][href="${CDN}/remote-1.css"]`)).toHaveLength(1)
    expect(net.calls.filter((u) => u.endsWith('.json'))).toHaveLength(1)
    net.releaseJs()
  })

  it('isolate do registro decide o modo do CSS no preload()', async () => {
    const net = network('registro.css')
    register('carrinho', { url: `${CDN}/vitral.json`, isolate: 'shadow' })
    preload('carrinho')
    await flush()
    expect(net.calls).toContain(`${CDN}/registro.css`)
    expect(document.head.querySelector('link[rel="preload"]')).toBeNull()
    net.releaseJs()
  })
})

describe('preconnect', () => {
  it('abre conexão com cada origem de remote, uma vez só', () => {
    configure({
      remotes: {
        a: 'https://cdn.empresa.com/a/vitral.json',
        b: 'https://cdn.empresa.com/b/vitral.json',
        c: 'https://outro.com/c/vitral.json',
        local: '/remotes/local/vitral.json',
        mod: { module: { mount: () => ({ unmount() {} }) } },
      },
    })
    const links = [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="preconnect"]')]
    expect(links.map((l) => l.href.replace(/\/$/, ''))).toEqual(['https://cdn.empresa.com', 'https://outro.com'])
    expect(links.every((l) => l.crossOrigin === 'anonymous')).toBe(true)
  })
})
