// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { embed } from '../src/embed'
import { cleanup, FIXTURE_REMOTE } from './helpers'

afterEach(cleanup)

const CDN = 'https://cdn.empresa.com/chat/stable/vitral.json'

/** Manifesto do CDN apontando para o remote em disco. */
function serve() {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ name: 'chat', entry: FIXTURE_REMOTE })))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

/** `<script>` com os `data-*` do loader. O fixture vem de `file:` (origem "null"), daí o `data-origins`. */
function tag(attrs: Record<string, string>, parent: Element = document.body) {
  const script = document.createElement('script')
  for (const [k, v] of Object.entries({ 'data-origins': 'null', ...attrs })) script.setAttribute(k, v)
  parent.append(script)
  return script
}

const slot = (el: Element) => el.querySelector('[data-vitral-slot]')

describe('embed.js (loader para sites de terceiros)', () => {
  it('monta no data-target com Shadow DOM e as props de data-props, uma vez só por script', async () => {
    serve()
    document.body.innerHTML = '<div id="chat"></div>'
    const script = tag({ 'data-remote': CDN, 'data-target': '#chat', 'data-props': '{"n":"pt"}' })
    const el = embed(script)!
    expect(el.parentElement!.id).toBe('chat')
    expect(el.getAttribute('isolate')).toBe('shadow')
    await vi.waitFor(() => expect(slot(el)!.shadowRoot?.textContent).toBe('chat:pt'))
    expect(fetch).toHaveBeenCalledWith(CDN, expect.anything())
    expect(embed(script)).toBeNull()
    expect(document.querySelectorAll('vitral-remote')).toHaveLength(1)
  })

  it('sem data-target fica logo depois do script; data-isolate="none" monta sem Shadow DOM', async () => {
    serve()
    document.body.innerHTML = '<p>antes</p>'
    const script = tag({ 'data-remote': CDN, 'data-isolate': 'none', 'data-props': '{"n":1}' })
    const el = embed(script)!
    expect(script.nextElementSibling).toBe(el)
    await vi.waitFor(() => expect(el.getAttribute('data-vitral-status')).toBe('ready'))
    expect(slot(el)!.shadowRoot).toBeNull()
    expect(slot(el)!.textContent).toBe('chat:1')
  })

  it('script no head põe o widget no fim do body', () => {
    serve()
    const el = embed(tag({ 'data-remote': CDN }, document.head))!
    expect(el.parentElement).toBe(document.body)
  })

  it('com async antes do destino existir, espera o HTML terminar de carregar', async () => {
    serve()
    const state = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading')
    const script = tag({ 'data-remote': CDN, 'data-target': '#depois' })
    expect(embed(script)).toBeNull()
    state.mockRestore()
    document.body.insertAdjacentHTML('beforeend', '<div id="depois"></div>')
    document.dispatchEvent(new Event('DOMContentLoaded'))
    expect(document.querySelector('#depois vitral-remote')).not.toBeNull()
  })

  it('destino que não existe depois de carregar: avisa e não monta', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(embed(tag({ 'data-remote': CDN, 'data-target': '#nada' }))).toBeNull()
    expect(error).toHaveBeenCalledWith('[vitral] data-target não encontrado: #nada')
    expect(embed(document.createElement('script'))).toBeNull()
    error.mockRestore()
  })

  it('<vitral-remote> injetado no site com outra origem não executa nada', async () => {
    const fetch = serve()
    embed(tag({ 'data-remote': CDN }))
    document.body.insertAdjacentHTML('beforeend', '<vitral-remote src="https://atacante.com/vitral.json"></vitral-remote>')
    const injetado = document.querySelector<HTMLElement>('vitral-remote[src^="https://atacante"]')!
    const erros: any[] = []
    injetado.addEventListener('vitral-error', (e) => erros.push((e as CustomEvent).detail.error))
    await vi.waitFor(() => expect(erros).toHaveLength(1))
    expect(erros[0].code).toBe('ORIGIN_BLOCKED')
    expect(fetch).not.toHaveBeenCalledWith('https://atacante.com/vitral.json', expect.anything())
  })

  it('várias cópias do loader na página usam a primeira', () => {
    expect((globalThis as any)[Symbol.for('vitral:embed')]).toBe(embed)
  })
})
