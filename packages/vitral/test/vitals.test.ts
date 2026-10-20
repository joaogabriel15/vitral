// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mounted } from '../src/core/errors'
import { otelVitals } from '../src/otel'
import { owner, rating, vitals, type VitalReport } from '../src/vitals'
import { cleanup } from './helpers'

type Fake = Record<string, unknown> & { entryType: string; startTime?: number }

/** PerformanceObserver simulado: `emit` entrega entradas aos observers do tipo. */
function fakeObserver(types: string[]) {
  const live = new Map<string, Set<(e: Fake[]) => void>>()
  const pending = new Map<string, Fake[]>()
  class PO {
    static supportedEntryTypes = types
    cb: (list: { getEntries(): Fake[] }) => void
    type = ''
    constructor(cb: PO['cb']) {
      this.cb = cb
    }
    observe(o: { type: string }) {
      this.type = o.type
      if (!live.has(o.type)) live.set(o.type, new Set())
      live.get(o.type)!.add(this.deliver)
    }
    deliver = (e: Fake[]) => this.cb({ getEntries: () => e })
    takeRecords() {
      const e = pending.get(this.type) ?? []
      pending.delete(this.type)
      return e
    }
    disconnect() {
      live.get(this.type)?.delete(this.deliver)
    }
  }
  vi.stubGlobal('PerformanceObserver', PO)
  return {
    emit(...entries: Fake[]) {
      for (const e of entries) live.get(e.entryType)?.forEach((fn) => fn([{ startTime: 0, duration: 0, name: '', ...e }]))
    },
    /** Entrada que só sai no `takeRecords` (ainda na fila do navegador). */
    queue(e: Fake) {
      pending.set(e.entryType, [...(pending.get(e.entryType) ?? []), { startTime: 0, duration: 0, name: '', ...e }])
    },
    observing: () => [...live].filter(([, s]) => s.size).map(([t]) => t),
  }
}

const ALL = ['navigation', 'paint', 'largest-contentful-paint', 'layout-shift', 'event']

/** Monta o DOM de dois remotes e do host. */
function page() {
  document.body.innerHTML = `
    <main id="host"><p id="titulo">host</p></main>
    <div data-vitral-slot="carrinho"><div data-vitral-root="carrinho"><img id="banner"><button id="comprar">ok</button></div></div>
    <div data-vitral-root="busca"><input id="q"><div data-vitral-root="filtro"><span id="f">x</span></div></div>
    <div id="sombra"></div>`
  const host = document.getElementById('sombra')!
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = '<div data-vitral-root="perfil"><b id="nome">ana</b></div>'
  return { $: (id: string) => document.getElementById(id)!, shadow: root.getElementById('nome')! }
}

const rect = (w: number, h: number) => ({ width: w, height: h }) as DOMRectReadOnly

let reports: VitalReport[]
let stop: () => void
beforeEach(() => {
  history.pushState({}, '', '/loja')
  reports = []
})
afterEach(() => {
  stop?.()
  mounted.clear()
  cleanup()
})

const start = () => (stop = vitals({ onReport: (r) => reports.push(r) }))
const of = (name: string) => reports.filter((r) => r.name === name)

describe('owner', () => {
  it('acha o data-vitral-root mais próximo, até dentro de shadow root', () => {
    const { $, shadow } = page()
    expect(owner($('banner'))).toBe('carrinho')
    expect(owner($('f'))).toBe('filtro')
    expect(owner($('q'))).toBe('busca')
    expect(owner(shadow)).toBe('perfil')
    expect(owner(shadow.firstChild)).toBe('perfil')
    expect(owner($('titulo'))).toBe('')
    expect(owner(null)).toBe('')
    expect(owner(document.createElement('div'))).toBe('')
  })
})

describe('rating', () => {
  it('usa os limites de web.dev', () => {
    expect(rating('LCP', 2500)).toBe('good')
    expect(rating('LCP', 2501)).toBe('needs-improvement')
    expect(rating('CLS', 0.3)).toBe('poor')
    expect(rating('INP', 200)).toBe('good')
    expect(rating('TTFB', 1000)).toBe('needs-improvement')
  })
})

describe('vitals', () => {
  it('sem PerformanceObserver não faz nada', () => {
    vi.stubGlobal('PerformanceObserver', undefined)
    start()
    stop()
    expect(reports).toEqual([])
  })

  it('só observa os tipos que o navegador tem', () => {
    const po = fakeObserver(['paint', 'event'])
    start()
    expect(po.observing().sort()).toEqual(['event', 'paint'])
    stop()
    expect(po.observing()).toEqual([])
  })

  it('LCP vai para o remote do elemento, com a versão; FCP e TTFB são da página', () => {
    const { $ } = page()
    mounted.set('carrinho', { entry: 'https://cdn/c/remote.js', version: '1.4.2' })
    const po = fakeObserver(ALL)
    start()
    po.emit({ entryType: 'navigation', name: location.href, responseStart: 120, activationStart: 20 })
    po.emit({ entryType: 'paint', name: 'first-paint', startTime: 300 })
    po.emit({ entryType: 'paint', name: 'first-contentful-paint', startTime: 400 })
    po.emit({ entryType: 'largest-contentful-paint', startTime: 900, element: $('titulo') })
    po.emit({ entryType: 'largest-contentful-paint', startTime: 2800, element: $('banner') })
    stop()
    expect(reports).toEqual([
      { name: 'TTFB', route: '/loja', value: 100, rating: 'good' },
      { name: 'FCP', route: '/loja', value: 400, rating: 'good' },
      { name: 'LCP', remote: 'carrinho', version: '1.4.2', route: '/loja', value: 2800, rating: 'needs-improvement' },
    ])
  })

  it('CLS por remote: maior fonte do shift, janelas de sessão, sem input recente', () => {
    const { $ } = page()
    const po = fakeObserver(ALL)
    start()
    const shift = (t: number, value: number, ...sources: [Element, number][]) =>
      po.emit({ entryType: 'layout-shift', startTime: t, value, sources: sources.map(([node, a]) => ({ node, currentRect: rect(a, 1) })) })
    // A busca move uma área maior que o carrinho: o shift é dela.
    shift(100, 0.05, [$('banner'), 10], [$('q'), 50])
    shift(500, 0.04, [$('q'), 50])
    // Janela nova (mais de 1 s depois): 0.02 não supera 0.09.
    shift(2000, 0.02, [$('q'), 50])
    shift(2100, 0.2, [$('comprar'), 5])
    po.emit({ entryType: 'layout-shift', startTime: 2200, value: 1, hadRecentInput: true, sources: [] })
    po.emit({ entryType: 'layout-shift', startTime: 2300, value: 0.01, sources: [] })
    stop()
    const cls = Object.fromEntries(of('CLS').map((r) => [r.remote ?? 'host', r.value]))
    expect(cls.busca).toBeCloseTo(0.09)
    expect(cls.carrinho).toBe(0.2)
    expect(cls.host).toBe(0.01)
  })

  it('CLS: janela de sessão fecha em 5 s mesmo com shifts seguidos', () => {
    const { $ } = page()
    const po = fakeObserver(ALL)
    start()
    for (let t = 0; t <= 6000; t += 500) po.emit({ entryType: 'layout-shift', startTime: t, value: 0.01, sources: [{ node: $('q'), previousRect: rect(1, 1) }] })
    stop()
    expect(of('CLS')[0].value).toBeCloseTo(0.1)
  })

  it('INP por remote: a pior interação, agrupando eventos da mesma interação', () => {
    const { $, shadow } = page()
    const po = fakeObserver(ALL)
    start()
    po.emit({ entryType: 'event', interactionId: 1, duration: 80, target: $('comprar') })
    po.emit({ entryType: 'event', interactionId: 1, duration: 260, target: $('comprar') })
    po.emit({ entryType: 'event', interactionId: 2, duration: 120, target: $('comprar') })
    po.emit({ entryType: 'event', interactionId: 0, duration: 900, target: $('comprar') })
    po.emit({ entryType: 'event', interactionId: 3, duration: 48, target: shadow })
    stop()
    expect(of('INP').map((r) => [r.remote, r.value, r.rating])).toEqual([
      ['carrinho', 260, 'needs-improvement'],
      ['perfil', 48, 'good'],
    ])
  })

  it('INP ignora a pior a cada 50 interações', () => {
    const { $ } = page()
    const po = fakeObserver(ALL)
    start()
    for (let i = 1; i <= 60; i++) po.emit({ entryType: 'event', interactionId: i, duration: i == 60 ? 1000 : i, target: $('q') })
    stop()
    expect(of('INP')[0].value).toBe(59)
  })

  it('sem Soft Navigations, a rota é o pathname; trocar de rota relata a anterior', () => {
    const { $ } = page()
    const po = fakeObserver(ALL)
    start()
    po.emit({ entryType: 'layout-shift', startTime: 10, value: 0.3, sources: [{ node: $('banner') }], navigationId: 'ignorado' })
    history.pushState({}, '', '/busca')
    po.emit({ entryType: 'layout-shift', startTime: 3000, value: 0.02, sources: [{ node: $('q') }] })
    expect(reports).toEqual([{ name: 'CLS', remote: 'carrinho', route: '/loja', value: 0.3, rating: 'poor' }])
    history.pushState({}, '', '/loja')
    po.emit({ entryType: 'layout-shift', startTime: 6000, value: 0.3, sources: [{ node: $('banner') }] })
    stop()
    expect(reports.map((r) => [r.route, r.remote, r.value])).toEqual([
      ['/loja', 'carrinho', 0.3],
      ['/busca', 'busca', 0.02],
      ['/loja', 'carrinho', 0.3],
    ])
  })

  it('com Soft Navigations, agrupa por navigationId e usa a URL e o início da soft-navigation', () => {
    const { $ } = page()
    const po = fakeObserver([...ALL, 'soft-navigation'])
    start()
    po.emit({ entryType: 'navigation', name: 'http://localhost:3000/loja', navigationId: 'a', responseStart: 50 })
    po.emit({ entryType: 'largest-contentful-paint', startTime: 1000, element: $('titulo'), navigationId: 'a' })
    // O pathname já mudou, mas a entrada ainda é da navegação 'a'.
    history.pushState({}, '', '/busca')
    po.emit({ entryType: 'event', interactionId: 7, duration: 64, target: $('comprar'), navigationId: 'a' })
    // Entradas da navegação 'b' chegam antes da própria soft-navigation.
    po.emit({ entryType: 'largest-contentful-paint', startTime: 5600, element: $('q'), navigationId: 'b' })
    po.emit({ entryType: 'soft-navigation', name: 'http://localhost:3000/busca?q=1', startTime: 5000, navigationId: 'b' })
    po.emit({ entryType: 'layout-shift', startTime: 5700, value: 0.05, sources: [{ node: $('f') }], navigationId: 'b' })
    // Entrada atrasada de 'a' depois de 'a' fechar: descartada.
    po.emit({ entryType: 'event', interactionId: 8, duration: 999, target: $('comprar'), navigationId: 'a' })
    stop()
    expect(reports).toEqual([
      { name: 'TTFB', route: '/loja', navigationId: 'a', value: 50, rating: 'good' },
      { name: 'LCP', route: '/loja', navigationId: 'a', value: 1000, rating: 'good' },
      { name: 'INP', remote: 'carrinho', route: '/loja', navigationId: 'a', value: 64, rating: 'good' },
      { name: 'LCP', remote: 'busca', route: '/busca', navigationId: 'b', value: 600, rating: 'good' },
      { name: 'CLS', remote: 'filtro', route: '/busca', navigationId: 'b', value: 0.05, rating: 'good' },
    ])
  })

  it('aba oculta relata o que mudou, inclusive o que estava na fila; não repete valor igual', () => {
    const { $ } = page()
    const po = fakeObserver(ALL)
    start()
    po.emit({ entryType: 'layout-shift', startTime: 10, value: 0.05, sources: [{ node: $('q') }] })
    po.queue({ entryType: 'event', interactionId: 1, duration: 300, target: $('q') })
    const hide = (state: string) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    hide('visible')
    expect(reports).toEqual([])
    hide('hidden')
    expect(reports.map((r) => r.name)).toEqual(['CLS', 'INP'])
    hide('hidden')
    expect(reports).toHaveLength(2)
    po.emit({ entryType: 'layout-shift', startTime: 20, value: 0.05, sources: [{ node: $('q') }] })
    hide('hidden')
    expect(reports.map((r) => [r.name, r.value])).toEqual([['CLS', 0.05], ['INP', 300], ['CLS', 0.1]])
    delete (document as { visibilityState?: string }).visibilityState
  })

  it('erro no onReport não para a medição', () => {
    const { $ } = page()
    const po = fakeObserver(ALL)
    const seen: string[] = []
    stop = vitals({
      onReport(r) {
        seen.push(r.name)
        throw new Error('rum fora do ar')
      },
    })
    po.emit({ entryType: 'paint', name: 'first-contentful-paint', startTime: 10 })
    po.emit({ entryType: 'largest-contentful-paint', startTime: 20, element: $('q') })
    stop()
    expect(seen).toEqual(['FCP', 'LCP'])
  })

  it('observer que o navegador recusa é ignorado', () => {
    const po = fakeObserver(ALL)
    const Base = PerformanceObserver as unknown as new (cb: unknown) => { observe(o: { type: string }): void }
    vi.stubGlobal(
      'PerformanceObserver',
      class extends Base {
        static supportedEntryTypes = ALL
        observe(o: { type: string }) {
          if (o.type == 'event') throw new TypeError('durationThreshold')
          super.observe(o)
        }
      },
    )
    start()
    expect(po.observing()).not.toContain('event')
    expect(po.observing()).toContain('layout-shift')
  })
})

describe('otelVitals', () => {
  it('grava cada métrica num histograma, criado uma vez', () => {
    const record = vi.fn()
    const createHistogram = vi.fn(() => ({ record }))
    const onReport = otelVitals({ createHistogram })
    onReport({ name: 'CLS', remote: 'carrinho', version: '1.4.2', route: '/loja', navigationId: '3', value: 0.2, rating: 'needs-improvement' })
    onReport({ name: 'CLS', route: '/loja', value: 0.01, rating: 'good' })
    onReport({ name: 'LCP', route: '/', value: 900, rating: 'good' })
    expect(createHistogram.mock.calls).toEqual([
      ['vitral.vitals.cls', { unit: '1' }],
      ['vitral.vitals.lcp', { unit: 'ms' }],
    ])
    expect(record.mock.calls).toEqual([
      [0.2, { 'vitral.route': '/loja', 'vitral.rating': 'needs-improvement', 'vitral.remote': 'carrinho', 'vitral.version': '1.4.2', 'vitral.navigation_id': '3' }],
      [0.01, { 'vitral.route': '/loja', 'vitral.rating': 'good' }],
      [900, { 'vitral.route': '/', 'vitral.rating': 'good' }],
    ])
  })
})
