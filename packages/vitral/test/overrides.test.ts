// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configure, loadRemote, mountRemote, register, registerSrc, type RemoteError } from '../src/index'
import { activeOverrides, clearOverrides, devtools, getOverrides, setOverride } from '../src/devtools'
import { manifestUrl } from '../src/core/overrides'
import { cleanup, serveManifest } from './helpers'

const setURL = (url: string) => (window as any).happyDOM.setURL(url)

beforeEach(() => {
  setURL('http://localhost:3000/')
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  vi.restoreAllMocks()
})

const fail = (p: Promise<unknown>) => p.then(() => { throw new Error('deveria falhar') }, (e) => e as RemoteError)
const fetched = (fetch: ReturnType<typeof serveManifest>) => fetch.mock.calls.map((c) => String(c[0]))

describe('overrides', () => {
  it('?vitral=nome@url troca a URL em localhost', async () => {
    setURL('http://localhost:3000/?vitral=carrinho@http://localhost:5174')
    const fetch = serveManifest('carrinho')
    register('carrinho', { url: 'https://cdn.loja.com/carrinho/vitral.json', integrity: 'sha384-xxx', isolate: 'shadow' })
    const host = document.body.appendChild(document.createElement('div'))
    await mountRemote(host, 'carrinho', { n: 1 })
    expect(fetched(fetch)).toEqual(['http://localhost:5174/vitral.json'])
    // A integrity do host não vale para o override; o isolamento continua.
    expect(host.shadowRoot!.textContent).toBe('carrinho:1')
    expect(console.warn).toHaveBeenCalledWith('[vitral] override ativo: carrinho → http://localhost:5174/vitral.json (aba). Para limpar: ?vitral=off')
  })

  it('aceita vários pares e lê o localStorage', async () => {
    setURL('http://localhost:3000/?vitral=a@http://localhost:5001,b@http://localhost:5002/x/vitral.json')
    localStorage.setItem('vitral:overrides', JSON.stringify({ c: 'http://localhost:5003' }))
    const fetch = serveManifest('x')
    register('a', 'https://cdn.loja.com/a/vitral.json')
    register('b', 'https://cdn.loja.com/b/vitral.json')
    register('c', 'https://cdn.loja.com/c/vitral.json')
    await Promise.all(['a', 'b', 'c'].map(loadRemote))
    expect(fetched(fetch).sort()).toEqual(['http://localhost:5001/vitral.json', 'http://localhost:5002/x/vitral.json', 'http://localhost:5003/vitral.json'])
  })

  it('fora de localhost, sem a flag, não vale', async () => {
    setURL('https://loja.com/?vitral=carrinho@https://malicioso.com')
    localStorage.setItem('vitral:overrides', JSON.stringify({ carrinho: 'https://malicioso.com' }))
    const fetch = serveManifest('carrinho')
    register('carrinho', 'https://cdn.loja.com/carrinho/vitral.json')
    await loadRemote('carrinho')
    expect(fetched(fetch)).toEqual(['https://cdn.loja.com/carrinho/vitral.json'])
  })

  it('fora de localhost, vale com configure({ devOverrides: true })', async () => {
    setURL('https://staging.loja.com/?vitral=carrinho@https://dev.loja.com')
    const fetch = serveManifest('carrinho')
    configure({ devOverrides: true })
    register('carrinho', 'https://cdn.loja.com/carrinho/vitral.json')
    await loadRemote('carrinho')
    expect(fetched(fetch)).toEqual(['https://dev.loja.com/vitral.json'])
  })

  it('a origem do override passa pela allowlist explícita', async () => {
    setURL('http://localhost:3000/?vitral=carrinho@http://localhost:5174')
    serveManifest('carrinho', 'http://localhost:5174/r.js')
    configure({ allowedOrigins: ['https://cdn.loja.com'], retries: 0 })
    register('carrinho', 'https://cdn.loja.com/carrinho/vitral.json')
    // Passou da allowlist: falha só no import (o Node não importa http:).
    expect((await fail(loadRemote('carrinho'))).code).toBe('LOAD_FAILED')
  })

  it('remote de src é trocado pelo nome do manifesto', async () => {
    setURL('http://localhost:3000/?vitral=carrinho@http://localhost:5174')
    const fetch = serveManifest('carrinho')
    const host = document.body.appendChild(document.createElement('div'))
    await mountRemote(host, registerSrc('https://cdn.loja.com/c/vitral.json'), { n: 2 })
    expect(fetched(fetch)).toEqual(['https://cdn.loja.com/c/vitral.json', 'http://localhost:5174/vitral.json'])
    expect(host.textContent).toBe('carrinho:2')
  })

  it('localStorage com URL base, sem ?vitral=, também vale', async () => {
    localStorage.setItem('vitral:overrides', JSON.stringify({ busca: 'http://localhost:5006' }))
    const fetch = serveManifest('busca')
    register('busca', 'https://cdn.loja.com/busca/vitral.json')
    await loadRemote('busca')
    expect(fetched(fetch)).toEqual(['http://localhost:5006/vitral.json'])
  })

  it('?vitral= continua valendo na aba depois de navegar sem o parâmetro', async () => {
    setURL('http://localhost:3000/?vitral=perfil@http://localhost:5007')
    const fetch = serveManifest('perfil')
    register('perfil', 'https://cdn.loja.com/perfil/vitral.json')
    await loadRemote('perfil')
    // Outra página da mesma aba (ou reload sem a query): o registro novo baixa de novo.
    setURL('http://localhost:3000/conta')
    register('perfil', 'https://cdn.loja.com/perfil/vitral.json')
    await loadRemote('perfil')
    expect(fetched(fetch)).toEqual(['http://localhost:5007/vitral.json', 'http://localhost:5007/vitral.json'])
    expect(activeOverrides()).toEqual([{ name: 'perfil', value: 'http://localhost:5007', url: 'http://localhost:5007/vitral.json', source: 'aba' }])
  })

  it('?vitral=off limpa todos; nome@off limpa um', () => {
    localStorage.setItem('vitral:overrides', JSON.stringify({ a: 'http://localhost:5001' }))
    setURL('http://localhost:3000/?vitral=b@http://localhost:5002,c@http://localhost:5003')
    expect(activeOverrides().map((o) => `${o.name}:${o.source}`)).toEqual(['a:navegador', 'b:aba', 'c:aba'])
    setURL('http://localhost:3000/?vitral=b@off')
    expect(activeOverrides().map((o) => o.name)).toEqual(['a', 'c'])
    setURL('http://localhost:3000/?vitral=off')
    expect(activeOverrides()).toEqual([])
    expect(localStorage.getItem('vitral:overrides')).toBeNull()
    setURL('http://localhost:3000/')
    expect(activeOverrides()).toEqual([])
  })

  it('apelido (@pr-123) vira URL pelo modelo devOverrides.preview', async () => {
    setURL('https://staging.loja.com/?vitral=checkout@pr-123')
    const fetch = serveManifest('checkout')
    configure({ devOverrides: { preview: 'https://{name}-{ref}.preview.loja.com' } })
    register('checkout', 'https://cdn.loja.com/checkout/vitral.json')
    register('conta', 'https://staging.loja.com/conta/vitral.json')
    await Promise.all([loadRemote('checkout'), loadRemote('conta')])
    // O resto continua vindo do ambiente (staging).
    expect(fetched(fetch).sort()).toEqual(['https://checkout-pr-123.preview.loja.com/vitral.json', 'https://staging.loja.com/conta/vitral.json'])
  })

  it('apelido sem modelo é ignorado com aviso', async () => {
    setURL('http://localhost:3000/?vitral=ajuda@pr-9')
    const fetch = serveManifest('ajuda')
    register('ajuda', 'https://cdn.loja.com/ajuda/vitral.json')
    await loadRemote('ajuda')
    expect(fetched(fetch)).toEqual(['https://cdn.loja.com/ajuda/vitral.json'])
    expect(console.warn).toHaveBeenCalledWith('[vitral] override ajuda@pr-9 ignorado: falta configure({ devOverrides: { preview } })')
  })

  it('manifestUrl completa a URL base', () => {
    expect(manifestUrl('http://localhost:5174')).toBe('http://localhost:5174/vitral.json')
    expect(manifestUrl('http://localhost:5174/app/')).toBe('http://localhost:5174/app/vitral.json')
    expect(manifestUrl('http://localhost:5174/r.js')).toBe('http://localhost:5174/r.js')
  })
})

describe('vitral/devtools', () => {
  it('setOverride e getOverrides usam o localStorage', () => {
    setOverride('carrinho', 'http://localhost:5174')
    expect(getOverrides()).toEqual({ carrinho: 'http://localhost:5174/vitral.json' })
    setOverride('carrinho', null)
    expect(getOverrides()).toEqual({})
    expect(localStorage.getItem('vitral:overrides')).toBeNull()
  })

  it('setOverride guarda apelidos como estão', () => {
    setOverride('checkout', 'pr-123')
    expect(getOverrides()).toEqual({ checkout: 'pr-123' })
    clearOverrides()
    expect(getOverrides()).toEqual({})
  })

  it('o painel mostra os overrides da aba e limpa todos', () => {
    setURL('http://localhost:3000/?vitral=checkout@pr-7&x=1')
    configure({ devOverrides: { preview: 'https://{name}-{ref}.preview.loja.com/vitral.json' } })
    setOverride('conta', 'http://localhost:5175')
    devtools({ reload: false })
    const root = document.querySelector('[data-vitral-devtools]')!.shadowRoot!
    expect(root.querySelector('.toggle')!.textContent).toBe('vitral (2)')
    expect([...root.querySelectorAll('li')].map((li) => li.firstChild!.textContent)).toEqual([
      'conta → http://localhost:5175/vitral.json [navegador]',
      'checkout → https://checkout-pr-7.preview.loja.com/vitral.json [aba]',
    ])
    root.querySelector<HTMLButtonElement>('.limpar')!.click()
    expect(activeOverrides()).toEqual([])
    // Tira o ?vitral= da URL para o override não voltar no reload.
    expect(location.search).toBe('?x=1')
    expect(root.querySelector('.toggle')!.textContent).toBe('vitral')
  })

  it('localStorage inválido é ignorado', () => {
    localStorage.setItem('vitral:overrides', '{')
    expect(getOverrides()).toEqual({})
  })

  it('o painel lista, adiciona e remove overrides', () => {
    setOverride('conta', 'http://localhost:5175')
    const remove = devtools({ reload: false })
    const root = document.querySelector('[data-vitral-devtools]')!.shadowRoot!
    expect(root.querySelector('.panel')!.hasAttribute('hidden')).toBe(true)
    root.querySelector<HTMLButtonElement>('.toggle')!.click()
    expect(root.querySelector('.panel')!.hasAttribute('hidden')).toBe(false)
    expect(root.querySelector('li')!.textContent).toContain('conta → http://localhost:5175/vitral.json')
    expect(root.querySelector('.aviso')).toBeNull()

    root.querySelector<HTMLInputElement>('input[name=name]')!.value = 'carrinho'
    root.querySelector<HTMLInputElement>('input[name=url]')!.value = 'http://localhost:5174'
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    expect(getOverrides()).toEqual({ conta: 'http://localhost:5175/vitral.json', carrinho: 'http://localhost:5174/vitral.json' })

    root.querySelector<HTMLButtonElement>('[aria-label="remover override de conta"]')!.click()
    expect(Object.keys(getOverrides())).toEqual(['carrinho'])
    expect(root.querySelectorAll('li')).toHaveLength(1)
    remove()
    expect(document.querySelector('[data-vitral-devtools]')).toBeNull()
  })

  it('avisa quando os overrides estão desligados', () => {
    setURL('https://loja.com/')
    devtools()
    const root = document.querySelector('[data-vitral-devtools]')!.shadowRoot!
    expect(root.querySelector('.aviso')!.textContent).toContain('configure({ devOverrides: true })')
  })

  it('por padrão recarrega a página ao mudar', () => {
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...location, reload } as Location)
    setOverride('conta', 'http://localhost:5175')
    devtools()
    document.querySelector('[data-vitral-devtools]')!.shadowRoot!.querySelector<HTMLButtonElement>('li button')!.click()
    expect(reload).toHaveBeenCalled()
  })
})
