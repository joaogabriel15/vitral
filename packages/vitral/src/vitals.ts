/**
 * Web Vitals por remote e por rota, sem dependência:
 *
 *   import { vitals } from 'vitral/vitals'
 *
 *   const stop = vitals({ onReport: (r) => rum.send(r) })
 *
 * LCP, CLS e INP vão para o remote cujo elemento raiz (`data-vitral-root`)
 * contém o elemento da entrada: o elemento do LCP, a maior fonte do layout
 * shift, o alvo da interação. Fora de qualquer remote, `remote` fica ausente
 * (é do host). FCP e TTFB são da página e saem sem `remote`.
 *
 * Rota: com Soft Navigations (Chromium), cada entrada traz `navigationId` e a
 * rota é a URL da `soft-navigation`. Nos outros navegadores, a rota é o
 * `location.pathname` na hora da entrada. Cada métrica sai quando a rota muda,
 * quando a aba fica oculta e no `stop()`, só se o valor mudou desde o último
 * relatório. O que o navegador não mede (layout shift fora do Chromium, por
 * exemplo) simplesmente não sai.
 */
import { mounted } from './core/errors'

export type VitalName = 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB'
export type VitalRating = 'good' | 'needs-improvement' | 'poor'

export interface VitalReport {
  name: VitalName
  /** Remote dono do elemento. Ausente quando é do host ou da página. */
  remote?: string
  /** Versão do remote (do manifesto) na hora da medição. */
  version?: string
  /** Rota: pathname da navegação (soft ou não). */
  route: string
  /** `navigationId` das entradas, só com Soft Navigations. */
  navigationId?: string
  /** ms para LCP, INP, FCP e TTFB; sem unidade para CLS. */
  value: number
  rating: VitalRating
}

export interface VitalsOptions {
  onReport: (report: VitalReport) => void
}

/** Limites de "good" e "poor" de web.dev. */
const LIMITS: Record<VitalName, [number, number]> = {
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
  INP: [200, 500],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
}

export const rating = (name: VitalName, value: number): VitalRating =>
  value <= LIMITS[name][0] ? 'good' : value <= LIMITS[name][1] ? 'needs-improvement' : 'poor'

type Entry = PerformanceEntry & {
  navigationId?: string | number
  element?: Element | null
  target?: Node | null
  interactionId?: number
  value?: number
  hadRecentInput?: boolean
  sources?: { node?: Node | null; currentRect?: DOMRectReadOnly; previousRect?: DOMRectReadOnly }[]
  responseStart?: number
  activationStart?: number
}

/** Dono de `node`: o `data-vitral-root` mais próximo, atravessando shadow roots. `''` é o host. */
export function owner(node: Node | null | undefined): string {
  while (node) {
    const el = node.nodeType === 1 ? (node as Element) : node.parentElement
    const root = el?.closest('[data-vitral-root]')
    if (root) return root.getAttribute('data-vitral-root')!
    node = ((el ?? node).getRootNode() as ShadowRoot).host
  }
  return ''
}

interface Shift {
  first: number
  last: number
  current: number
  max: number
}

interface Nav {
  id?: string
  route: string
  /** Início da navegação (0 na carga da página). */
  start: number
  lcp?: [number, string]
  cls: Map<string, Shift>
  inp: Map<string, Map<number, number>>
  /** Último valor relatado de cada métrica e dono. */
  sent: Map<string, number>
}

/**
 * Observa as Web Vitals e chama `onReport` com cada uma, por remote e rota.
 * Devolve `stop`, que relata o que falta e desliga os observers.
 */
export function vitals({ onReport }: VitalsOptions): () => void {
  if (typeof PerformanceObserver == 'undefined') return () => {}
  const types = PerformanceObserver.supportedEntryTypes ?? []
  const soft = types.includes('soft-navigation')
  const navs = new Map<string, Nav>()
  const done = new Set<string>()
  /** Rota de cada `navigationId`. */
  const routes = new Map<string, [string, number]>()
  const versions = new Map<string, string | undefined>()
  const observers: PerformanceObserver[] = []

  const send = (name: VitalName, value: number, nav: Nav, who = '') => {
    const key = name + '|' + who
    if (nav.sent.get(key) === value) return
    nav.sent.set(key, value)
    const report: VitalReport = { name, route: routes.get(nav.id!)?.[0] ?? nav.route, value, rating: rating(name, value) }
    if (who) (report.remote = who), (report.version = versions.get(who))
    if (nav.id !== undefined) report.navigationId = nav.id
    if (report.version === undefined) delete report.version
    try {
      onReport(report)
    } catch {}
  }

  const flush = (nav: Nav) => {
    const start = routes.get(nav.id!)?.[1] ?? nav.start
    if (nav.lcp) send('LCP', Math.max(0, nav.lcp[0] - start), nav, nav.lcp[1])
    for (const [who, s] of nav.cls) send('CLS', s.max, nav, who)
    for (const [who, list] of nav.inp) {
      const all = [...list.values()].sort((a, b) => b - a)
      // p98: a pior interação, ignorando uma a cada 50.
      send('INP', all[Math.min(all.length - 1, Math.floor(all.length / 50))], nav, who)
    }
  }

  /** Navegação da entrada. Uma navegação nova fecha as anteriores. */
  const navOf = (e: Entry): Nav | undefined => {
    const id = soft && e.navigationId != null ? String(e.navigationId) : undefined
    const key = id ?? 'r:' + location.pathname
    // Entrada atrasada de uma navegação soft já fechada.
    if (done.has(key)) return
    let nav = navs.get(key)
    if (!nav) {
      for (const [k, old] of navs) flush(old), navs.delete(k), old.id !== undefined && done.add(k)
      navs.set(key, (nav = { id, route: location.pathname, start: 0, cls: new Map(), inp: new Map(), sent: new Map() }))
    }
    return nav
  }

  const who = (node: Node | null | undefined) => {
    const name = owner(node)
    if (name && !versions.has(name)) versions.set(name, mounted.get(name)?.version)
    return name
  }

  const handle = (e: Entry) => {
    switch (e.entryType) {
      case 'soft-navigation': {
        // A `soft-navigation` chega depois das entradas que já são dela; a rota é lida no flush.
        routes.set(String(e.navigationId), [new URL(e.name, location.href).pathname, e.startTime])
        return
      }
      case 'navigation': {
        if (e.navigationId != null && soft) routes.set(String(e.navigationId), [new URL(e.name, location.href).pathname, 0])
        const nav = navOf(e)
        if (nav && e.responseStart! > 0) send('TTFB', Math.max(0, e.responseStart! - (e.activationStart ?? 0)), nav)
        return
      }
      case 'paint': {
        const nav = e.name == 'first-contentful-paint' && navOf(e)
        if (nav) send('FCP', Math.max(0, e.startTime - (activation() ?? 0)), nav)
        return
      }
      case 'largest-contentful-paint': {
        const nav = navOf(e)
        if (nav) nav.lcp = [e.startTime, who(e.element)]
        return
      }
      case 'layout-shift': {
        if (e.hadRecentInput) return
        const nav = navOf(e)
        if (!nav) return
        let big: Node | null | undefined
        let area = -1
        for (const s of e.sources ?? []) {
          const r = s.currentRect ?? s.previousRect
          const a = r ? r.width * r.height : 0
          if (a > area) (area = a), (big = s.node)
        }
        const name = who(big)
        const t = e.startTime
        const s = nav.cls.get(name)
        if (s && t - s.last < 1000 && t - s.first < 5000) s.current += e.value!
        else if (s) (s.current = e.value!), (s.first = t)
        if (s) (s.last = t), (s.max = Math.max(s.max, s.current))
        else nav.cls.set(name, { first: t, last: t, current: e.value!, max: e.value! })
        return
      }
      case 'event': {
        if (!e.interactionId) return
        const nav = navOf(e)
        if (!nav) return
        const name = who(e.target)
        const list = nav.inp.get(name) ?? new Map<number, number>()
        nav.inp.set(name, list)
        list.set(e.interactionId, Math.max(list.get(e.interactionId) ?? 0, e.duration))
      }
    }
  }

  const activation = () => (performance.getEntriesByType?.('navigation')[0] as Entry | undefined)?.activationStart

  // `soft-navigation` primeiro, para a rota já existir quando as outras chegarem.
  for (const type of ['soft-navigation', 'navigation', 'paint', 'largest-contentful-paint', 'layout-shift', 'event']) {
    if (!types.includes(type)) continue
    try {
      const o = new PerformanceObserver((list) => list.getEntries().forEach((e) => handle(e as Entry)))
      o.observe({ type, buffered: true, durationThreshold: 40, includeSoftNavigationObservations: true } as PerformanceObserverInit)
      observers.push(o)
    } catch {}
  }

  const all = () => {
    for (const o of observers) o.takeRecords().forEach((e) => handle(e as Entry))
    navs.forEach(flush)
  }
  const hidden = () => document.visibilityState == 'hidden' && all()
  document.addEventListener('visibilitychange', hidden)
  return () => {
    document.removeEventListener('visibilitychange', hidden)
    all()
    observers.forEach((o) => o.disconnect())
    observers.length = 0
  }
}
