// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { navigate } from '../src/index'
import { defineVitralOutlet, matchRoute, routes } from '../src/routes'
import { failingRemote, mockRemote } from '../src/testing'
import { cleanup, flush } from './helpers'

let stop: (() => void) | null = null
afterEach(() => {
  stop?.()
  stop = null
  history.replaceState(null, '', '/')
  cleanup()
})

const TABLE = { '/checkout/*': 'checkout', '/conta': 'conta', '/produto/:id': 'produto', '/': 'inicio' }

describe('matchRoute', () => {
  it('prefixo, exato, parâmetro e raiz', () => {
    expect(matchRoute('/checkout', TABLE)?.name).toBe('checkout')
    expect(matchRoute('/checkout/pagamento/2', TABLE)?.name).toBe('checkout')
    expect(matchRoute('/checkoutx', TABLE)).toBeNull()
    expect(matchRoute('/conta', TABLE)?.name).toBe('conta')
    expect(matchRoute('/conta/', TABLE)?.name).toBe('conta')
    expect(matchRoute('/conta/dados', TABLE)).toBeNull()
    expect(matchRoute('/produto/42', TABLE)).toEqual({ name: 'produto', pattern: '/produto/:id', params: { id: '42' } })
    expect(matchRoute('/', TABLE)?.name).toBe('inicio')
    expect(matchRoute('/sobre', TABLE)).toBeNull()
  })

  it('* pega tudo, e a primeira rota que bate vence', () => {
    expect(matchRoute('/qualquer/coisa', { '/a': 'a', '*': 'resto' })?.name).toBe('resto')
    expect(matchRoute('/a', { '*': 'resto', '/a': 'a' })?.name).toBe('resto')
  })

  it('caracteres especiais do padrão não viram regex', () => {
    expect(matchRoute('/a.b', { '/a.b': 'x' })?.name).toBe('x')
    expect(matchRoute('/aXb', { '/a.b': 'x' })).toBeNull()
  })
})

describe('<vitral-outlet>', () => {
  it('monta o remote da rota e troca ao navegar, sem remontar dentro do mesmo remote', async () => {
    const checkout = mockRemote('checkout', (el, p) => (el.textContent = `checkout ${p.user}`))
    const conta = mockRemote('conta', (el) => (el.textContent = 'conta'))
    history.replaceState(null, '', '/checkout')
    stop = routes(TABLE)
    document.body.innerHTML = `<vitral-outlet props='{"user":1}'></vitral-outlet>`
    const outlet = document.querySelector('vitral-outlet')!
    await flush()
    expect(outlet.textContent).toBe('checkout 1')
    expect(outlet.route).toBe('checkout')
    expect(outlet.getAttribute('data-vitral-route')).toBe('checkout')

    navigate('/checkout/pagamento')
    await flush()
    expect(checkout.mounts).toBe(1)

    navigate('/conta')
    await flush()
    expect(checkout.mounted).toBe(false)
    expect(conta.mounted).toBe(true)
    expect(outlet.textContent).toBe('conta')

    outlet.props = { user: 2 }
    expect(conta.lastProps).toEqual({ user: 2 })
  })

  it('sem rota mostra o slot empty e desmonta o que havia', async () => {
    const inicio = mockRemote('inicio')
    stop = routes(TABLE)
    document.body.innerHTML = `<vitral-outlet><p slot="empty">nada</p><p slot="fallback">carregando</p></vitral-outlet>`
    const outlet = document.querySelector('vitral-outlet')!
    await flush()
    expect(inicio.mounted).toBe(true)
    expect(outlet.querySelector<HTMLElement>('[slot=empty]')!.hidden).toBe(true)
    navigate('/sobre')
    await flush()
    expect(inicio.mounted).toBe(false)
    expect(outlet.route).toBeNull()
    expect(outlet.status).toBe('empty')
    expect(outlet.getAttribute('data-vitral-status')).toBe('empty')
    expect(outlet.querySelector<HTMLElement>('[slot=empty]')!.hidden).toBe(false)
  })

  it('outlet criado antes de routes() começa vazio e monta quando as rotas chegam', async () => {
    mockRemote('inicio', (el) => (el.textContent = 'oi'))
    defineVitralOutlet()
    document.body.innerHTML = `<vitral-outlet></vitral-outlet>`
    const outlet = document.querySelector('vitral-outlet')!
    expect(outlet.getAttribute('data-vitral-status')).toBe('empty')
    stop = routes(TABLE)
    await flush()
    expect(outlet.textContent).toBe('oi')
    stop()
    stop = null
    await flush()
    expect(outlet.route).toBeNull()
  })

  it('erro mostra o slot error e dispara vitral-error; ready dispara vitral-ready', async () => {
    failingRemote('conta')
    mockRemote('inicio')
    stop = routes(TABLE)
    document.body.innerHTML = `<vitral-outlet><p slot="error">quebrou</p></vitral-outlet>`
    const outlet = document.querySelector('vitral-outlet')!
    const got: string[] = []
    outlet.addEventListener('vitral-ready', (e) => got.push('ready:' + (e as CustomEvent).detail.route))
    outlet.addEventListener('vitral-error', () => got.push('error'))
    await flush()
    navigate('/conta')
    await flush()
    expect(got).toEqual(['ready:inicio', 'error'])
    expect(outlet.querySelector<HTMLElement>('[slot=error]')!.hidden).toBe(false)
    mockRemote('conta', (el) => (el.textContent = 'voltou'))
    outlet.retry()
    await flush()
    expect(outlet.textContent).toContain('voltou')
  })

  it('isolate="shadow" e troca de isolate pelo atributo', async () => {
    mockRemote('inicio', (el) => (el.innerHTML = '<b>x</b>'))
    stop = routes(TABLE)
    document.body.innerHTML = `<vitral-outlet isolate="shadow"></vitral-outlet>`
    const outlet = document.querySelector('vitral-outlet')!
    await flush()
    expect(outlet.querySelector('[data-vitral-slot]')!.shadowRoot!.querySelector('b')).not.toBeNull()
    outlet.setAttribute('isolate', '')
    await flush()
    expect(outlet.querySelector('b')).not.toBeNull()
  })

  it('props inválidas no atributo vão para o console', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    stop = routes({})
    document.body.innerHTML = `<vitral-outlet props="{x"></vitral-outlet>`
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it('sair do DOM desmonta; mover no DOM não', async () => {
    const inicio = mockRemote('inicio')
    stop = routes(TABLE)
    document.body.innerHTML = `<div id="a"><vitral-outlet></vitral-outlet></div><div id="b"></div>`
    const outlet = document.querySelector('vitral-outlet')!
    await flush()
    document.querySelector('#b')!.appendChild(outlet)
    await flush()
    expect(inicio.mounts).toBe(1)
    expect(inicio.mounted).toBe(true)
    outlet.remove()
    await flush()
    expect(inicio.mounted).toBe(false)
  })
})

describe('links', () => {
  const click = (a: Element, init: MouseEventInit = {}) => {
    const e = new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, button: 0, ...init })
    a.dispatchEvent(e)
    return e
  }

  it('link interno de uma rota navega sem recarregar', async () => {
    mockRemote('inicio')
    mockRemote('conta', (el) => (el.textContent = 'conta'))
    stop = routes(TABLE)
    document.body.innerHTML = `<vitral-outlet></vitral-outlet><a href="/conta">conta</a>`
    await flush()
    const e = click(document.querySelector('a')!)
    expect(e.defaultPrevented).toBe(true)
    expect(location.pathname).toBe('/conta')
    await flush()
    expect(document.querySelector('vitral-outlet')!.textContent).toBe('conta')
  })

  it('enxerga links dentro de Shadow DOM', () => {
    stop = routes(TABLE)
    const host = document.body.appendChild(document.createElement('div'))
    const root = host.attachShadow({ mode: 'open' })
    root.innerHTML = '<a href="/conta"><span>ir</span></a>'
    expect(click(root.querySelector('span')!).defaultPrevented).toBe(true)
    expect(location.pathname).toBe('/conta')
  })

  it('deixa passar o que não é rota, outra origem, target, download, modificador e clique já tratado', () => {
    stop = routes(TABLE)
    const push = vi.spyOn(history, 'pushState')
    // Evita a navegação real do happy-dom; window recebe o clique depois do document.
    const block = (e: Event) => e.preventDefault()
    addEventListener('click', block)
    document.body.innerHTML = `
      <a id="sobre" href="/sobre">x</a>
      <a id="fora" href="https://outro.com/conta">x</a>
      <a id="nova" href="/conta" target="_blank">x</a>
      <a id="baixar" href="/conta" download>x</a>
      <a id="ok" href="/conta">x</a>`
    for (const id of ['sobre', 'fora', 'nova', 'baixar']) click(document.getElementById(id)!)
    const ok = document.getElementById('ok')!
    click(ok, { ctrlKey: true })
    click(ok, { button: 1 })
    ok.addEventListener('click', (e) => e.preventDefault(), { once: true })
    click(ok)
    removeEventListener('click', block)
    expect(push).not.toHaveBeenCalled()
    push.mockRestore()
  })

  it('links: false não intercepta', () => {
    stop = routes(TABLE, { links: false })
    document.body.innerHTML = `<a href="/conta">x</a>`
    const a = document.querySelector('a')!
    a.addEventListener('click', (e) => e.preventDefault(), { once: true })
    click(a)
    expect(location.pathname).toBe('/')
  })
})
