// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { configure, loadRemote, register } from '../src/index'
import { pickLanguage, resetTranslations } from '../src/core/i18n'
import { fallbacks, i18next } from '../src/i18n'
import { cleanup, FIXTURE_REMOTE } from './helpers'

afterEach(() => {
  cleanup()
  resetTranslations()
})

const BASE = 'https://cdn.empresa.com/conta/'
const files = { 'pt-BR': { conta: 'i18n/pt-BR/conta-a.json' }, en: { conta: 'i18n/en/conta-b.json' }, es: { conta: 'i18n/es/conta-c.json' } }
const words: Record<string, unknown> = {
  [BASE + 'i18n/pt-BR/conta-a.json']: { titulo: 'Minha conta' },
  [BASE + 'i18n/en/conta-b.json']: { titulo: 'My account' },
  [BASE + 'i18n/es/conta-c.json']: { titulo: 'Mi cuenta' },
}

/** fetch falso: o manifesto do remote e as traduções. */
function network() {
  const fetch = vi.fn(async (url: string) => {
    if (url === BASE + 'vitral.json') return new Response(JSON.stringify({ name: 'conta', entry: FIXTURE_REMOTE, i18n: files }))
    if (url in words) return new Response(JSON.stringify(words[url]))
    return new Response('', { status: 404 })
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

/** Instância falsa do i18next, com o que o adaptador usa. */
function fakeI18next(language: string, fallbackLng: unknown = 'en') {
  const listeners = new Set<(lng: string) => void>()
  const bundles: Record<string, Record<string, unknown>> = {}
  const i = {
    language,
    options: { fallbackLng },
    bundles,
    addResourceBundle: vi.fn((lng: string, ns: string, data: any) => void ((bundles[lng] ??= {})[ns] = data)),
    on: (_: string, fn: (lng: string) => void) => void listeners.add(fn),
    off: (_: string, fn: (lng: string) => void) => void listeners.delete(fn),
    changeLanguage: vi.fn((lng?: string) => {
      if (lng) i.language = lng
      for (const fn of listeners) fn(i.language)
    }),
  }
  return i
}

describe('pickLanguage', () => {
  it('a mesma língua, a base, uma variante da base e o fallback, nessa ordem', () => {
    expect(pickLanguage('pt-BR', ['en', 'pt-BR', 'pt'])).toBe('pt-BR')
    expect(pickLanguage('pt-BR', ['en', 'pt'])).toBe('pt')
    expect(pickLanguage('pt', ['en', 'pt-PT'])).toBe('pt-PT')
    expect(pickLanguage('fr', ['en', 'pt'], ['de', 'en'])).toBe('en')
    expect(pickLanguage('fr', ['en', 'pt'])).toBeUndefined()
    expect(pickLanguage('PT_br', ['pt-BR'])).toBe('pt-BR')
  })
})

describe('fallbacks do i18next', () => {
  it('texto, lista, objeto por língua e função', () => {
    expect(fallbacks('en')).toEqual(['en'])
    expect(fallbacks(['es', 'en'])).toEqual(['es', 'en'])
    expect(fallbacks({ 'pt-BR': ['pt'], default: ['en'] }, 'pt-BR')).toEqual(['pt', 'en'])
    expect(fallbacks((lng: string) => (lng === 'pt-BR' ? 'pt' : 'en'), 'pt-BR')).toEqual(['pt'])
    expect(fallbacks(false)).toEqual([])
  })
})

describe('traduções dos remotes', () => {
  it('baixa só a língua aberta, junto com o JS, e as traduções entram antes da montagem', async () => {
    const fetch = network()
    const i = fakeI18next('pt-BR')
    configure({ allowedOrigins: ['*'], retries: 0, i18n: i18next(i) })
    register('conta', BASE + 'vitral.json')
    await loadRemote('conta')
    expect(i.bundles).toEqual({ 'pt-BR': { conta: { titulo: 'Minha conta' } } })
    const pedidos = fetch.mock.calls.map((c) => c[0])
    expect(pedidos.filter((u) => u.includes('/i18n/'))).toEqual([BASE + 'i18n/pt-BR/conta-a.json'])
  })

  it('sem a língua aberta no remote, usa o fallbackLng', async () => {
    network()
    const i = fakeI18next('fr', ['es', 'en'])
    configure({ allowedOrigins: ['*'], retries: 0, i18n: i18next(i) })
    register('conta', BASE + 'vitral.json')
    await loadRemote('conta')
    expect(Object.keys(i.bundles)).toEqual(['es'])
  })

  it('numa troca de língua, baixa a nova e desenha de novo uma vez', async () => {
    const fetch = network()
    const i = fakeI18next('pt-BR')
    configure({ allowedOrigins: ['*'], retries: 0, i18n: i18next(i) })
    register('conta', BASE + 'vitral.json')
    await loadRemote('conta')
    i.changeLanguage('en')
    await vi.waitFor(() => expect(i.bundles.en).toEqual({ conta: { titulo: 'My account' } }))
    // A primeira troca é a do app; a segunda, do vitral, para o react-i18next desenhar com as traduções novas.
    await vi.waitFor(() => expect(i.changeLanguage).toHaveBeenCalledTimes(2))
    await new Promise((r) => setTimeout(r, 20))
    expect(i.changeLanguage).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls.filter((c) => String(c[0]).includes('/i18n/en/'))).toHaveLength(1)
  })

  it('tradução que falha não impede a montagem', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.endsWith('vitral.json') ? new Response(JSON.stringify({ name: 'conta', entry: FIXTURE_REMOTE, i18n: files })) : new Response('', { status: 500 }))))
    const i = fakeI18next('pt-BR')
    configure({ allowedOrigins: ['*'], retries: 0, i18n: i18next(i) })
    register('conta', BASE + 'vitral.json')
    expect(typeof (await loadRemote('conta')).mount).toBe('function')
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/conta: traduções não carregaram/), expect.anything())
    warn.mockRestore()
  })

  it('sem configure({ i18n }), nada de traduções', async () => {
    const fetch = network()
    configure({ allowedOrigins: ['*'], retries: 0 })
    register('conta', BASE + 'vitral.json')
    await loadRemote('conta')
    expect(fetch.mock.calls.some((c) => String(c[0]).includes('/i18n/'))).toBe(false)
  })
})
