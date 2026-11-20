// @vitest-environment happy-dom
// Troca de remote numa navegação: anúncio ao leitor de tela e foco no h1.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { navigate, register } from '../src/index'
import { announceRoute, routes } from '../src/routes'
import { cleanup, flush } from './helpers'

let stop: (() => void) | null = null
afterEach(() => {
  stop?.()
  stop = null
  history.replaceState(null, '', '/')
  cleanup()
})

const page = (title: string) => ({ mount: (el: HTMLElement) => ((el.innerHTML = `<h1>${title}</h1><p>texto</p>`), { unmount() {} }) })
const announcer = () => document.querySelector('[data-vitral-announcer]')

describe('acessibilidade na troca de remote', () => {
  it('navegar para outro remote anuncia o h1 e põe o foco nele', async () => {
    register('inicio', { module: page('Início') })
    register('conta', { module: page('Minha conta') })
    stop = routes({ '/conta': 'conta', '/': 'inicio' })
    document.body.innerHTML = '<a href="/conta">conta</a><vitral-outlet></vitral-outlet>'
    await flush()
    // Primeira carga: nada de anúncio nem foco roubado.
    expect(announcer()).toBeNull()
    navigate('/conta')
    await vi.waitFor(() => expect(document.activeElement?.textContent).toBe('Minha conta'))
    expect(document.activeElement!.getAttribute('tabindex')).toBe('-1')
    await vi.waitFor(() => expect(announcer()!.textContent).toBe('Minha conta'))
    expect(announcer()!.getAttribute('aria-live')).toBe('assertive')
  })

  it('announce: false desliga', async () => {
    register('inicio', { module: page('Início') })
    register('conta', { module: page('Minha conta') })
    stop = routes({ '/conta': 'conta', '/': 'inicio' }, { announce: false })
    document.body.innerHTML = '<vitral-outlet></vitral-outlet>'
    await flush()
    navigate('/conta')
    await flush(10)
    expect(document.querySelector('vitral-outlet')!.textContent).toBe('Minha contatexto')
    expect(announcer()).toBeNull()
  })

  it('announceRoute sem h1 usa o document.title e foca o contêiner', async () => {
    document.title = 'Pedidos'
    const box = document.body.appendChild(document.createElement('div'))
    box.innerHTML = '<p>sem título</p>'
    announceRoute(box)
    expect(document.activeElement).toBe(box)
    await vi.waitFor(() => expect(announcer()!.textContent).toBe('Pedidos'))
  })

  it('acha o h1 dentro de Shadow DOM', () => {
    const box = document.body.appendChild(document.createElement('div'))
    const inner = box.appendChild(document.createElement('div')).attachShadow({ mode: 'open' })
    inner.innerHTML = '<h1>Carrinho</h1>'
    announceRoute(box)
    expect(inner.activeElement?.textContent ?? document.activeElement?.shadowRoot?.activeElement?.textContent).toBe('Carrinho')
  })
})
