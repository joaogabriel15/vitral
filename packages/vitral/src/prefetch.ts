/**
 * Prefetch preditivo de remotes:
 *
 *   import { prefetch } from 'vitral/prefetch'
 *   prefetch()
 *
 * Conta as transições entre rotas (cadeia de Markov de ordens 1 a 3) e quais
 * remotes cada rota monta, no localStorage. No tempo ocioso, baixa o manifesto
 * e os arquivos dos remotes da rota seguinte mais provável, sem executar nada
 * e com o SRI do vitral (`core/sri.ts`), quando vale a pena: a probabilidade
 * vezes o tempo poupado tem de passar o custo dos bytes na rede de agora.
 * Num `pointerdown` em link para outra rota, baixa os remotes dela na hora.
 */
import { resolveEntry } from './core/loader'
import { empty, parse, predictNext, recordPath, remember, type Chain, type Prior } from './core/markov'
import type { Verifiable } from './core/sri'
import { policy } from './core/policy'
import { protocol } from './core/state'
import type { RemoteEntry } from './core/types'
import { addLink } from './core/util'

export interface PrefetchOptions {
  /** Probabilidade mínima da rota seguinte, antes da conta de custo. Padrão: 0.1. */
  threshold?: number
  /** Transições contadas a partir da rota atual (ou do contexto) antes de prever. Padrão: 2. */
  min?: number
  /**
   * Transições da população, para a primeira visita: o objeto ou a URL do
   * JSON (`vitral prior` gera a partir de sessões agregadas). Mistura com as
   * contagens do usuário: usuário + `alpha` × população.
   */
  prior?: Prior | string
  /** Peso da população, em transições. Padrão: 5. */
  alpha?: number
  /**
   * Custo de cada byte baixado à toa, em ms de espera do usuário. Prefetch só
   * quando probabilidade × tempo poupado > custo × bytes. Padrão: 0.0005
   * (100 kB valem 50 ms). `0` desliga a conta.
   */
  byteCost?: number
  /**
   * Speculation Rules (Chrome 121+) para a rota prevista quando ela não tem
   * remote: o navegador baixa o documento dela. Só com a chave padrão (`pathname`). Padrão: false.
   */
  speculate?: boolean
  /** Onde guardar as contagens. `null` guarda só na memória. Padrão: localStorage. */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
  /** Chave da rota. Padrão: `url.pathname`. */
  key?: (url: URL) => string
  /** Chamado depois de baixar os remotes previstos. */
  onPrefetch?: (remotes: string[], route: string) => void
}

const KEY = 'vitral:prefetch'

/**
 * Economia de dados ou 2G: não baixa nada a mais. Em 3G o prefetch previsto
 * continua: é onde ele economiza mais tempo.
 */
const slow = (): boolean => policy() === 'lazy'

const idle = (fn: () => void) =>
  typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 300)

/**
 * Começa a aprender as rotas e a pré-carregar o próximo remote. Devolve a
 * função que para tudo (as contagens continuam guardadas).
 */
export function prefetch(options: PrefetchOptions = {}): () => void {
  if (typeof window === 'undefined') return () => {}
  const { threshold = 0.1, min = 2, alpha = 5, byteCost = 0.0005, key = (u: URL) => u.pathname, onPrefetch } = options
  let prior: Prior | null = typeof options.prior === 'object' ? options.prior : null
  if (typeof options.prior === 'string')
    fetch(options.prior, { priority: 'low' } as RequestInit)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => p && typeof p.t === 'object' && ((prior = p), schedule()))
      .catch(() => {})
  let storage = options.storage
  if (storage === undefined)
    try {
      storage = localStorage
    } catch {
      storage = null
    }
  let chain: Chain = empty()
  try {
    chain = parse(storage?.getItem(KEY))
  } catch {}
  const save = () => {
    try {
      storage?.setItem(KEY, JSON.stringify(chain))
    } catch {}
  }
  const here = () => key(new URL(location.href))
  let current = here()
  // As últimas rotas, para os contextos de ordem 2 e 3.
  const history = [current]
  const remotesOf = (route: string) => chain.r[route] ?? prior?.r?.[route] ?? []
  /** Baixa os remotes de `route` que ainda não vieram. */
  const fetchFor = (route: string) => {
    const names = remotesOf(route).filter((n) => !loaded.has(n))
    if (!names.length) return
    for (const n of names) loaded.add(n)
    Promise.all(names.map(warm)).then((ok) => {
      const done = names.filter((_, i) => ok[i])
      if (done.length) onPrefetch?.(done, route)
    })
  }
  // Remotes já baixados nesta página (montados ou pré-carregados).
  const loaded = new Set<string>()
  let seq = 0

  const schedule = () => {
    const id = ++seq
    if (slow()) return
    idle(() => {
      const guess = id === seq && predictNext(chain, history, { threshold, min, prior, alpha })
      if (!guess) return
      const names = remotesOf(guess.to)
      if (!names.length) {
        if (options.speculate && !options.key && guess.to.startsWith('/')) speculate(guess.to)
        return
      }
      const bytes = names.reduce((a, n) => a + (chain.b?.[n] ?? 150_000), 0)
      if (worth(guess.p, bytes, byteCost)) fetchFor(guess.to)
    })
  }

  const visit = () => {
    const next = here()
    if (next === current) return
    recordPath(chain, history, next)
    current = next
    history.push(next)
    if (history.length > 3) history.shift()
    save()
    schedule()
  }

  // Cada montagem deixa `performance.measure('vitral:<nome>:mount')`; vale
  // para qualquer cópia da lib e para `<vitral-outlet>`, slots e adaptadores.
  let observer: PerformanceObserver | undefined
  try {
    observer = new PerformanceObserver((list) => {
      visit()
      let changed = false
      for (const e of list.getEntries()) {
        const m = /^vitral:(.+):mount$/.exec(e.name)
        if (!m) continue
        loaded.add(m[1])
        changed = remember(chain, current, m[1]) || changed
        const b = bytesOf(m[1])
        if (b) ((chain.b ??= {})[m[1]] = b), (changed = true)
      }
      if (changed) save()
    })
    observer.observe({ type: 'measure', buffered: true })
  } catch {}

  // Navigation API onde existe (vê também o pushState dos roteadores); senão, popstate.
  const nav = (globalThis as any).navigation
  const event = nav ? 'currententrychange' : 'popstate'
  const target: EventTarget = nav ?? window
  target.addEventListener(event, visit)
  // `pointerdown` vem cerca de 100 ms antes do clique: os remotes da rota do link já começam a baixar.
  const down = (e: Event) => {
    if (slow()) return
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
    if (!a) return
    const url = new URL(a.href, location.href)
    if (url.origin === location.origin) fetchFor(key(url))
  }
  document.addEventListener('pointerdown', down, { passive: true })
  schedule()
  return () => {
    seq++
    observer?.disconnect()
    target.removeEventListener(event, visit)
    document.removeEventListener('pointerdown', down)
  }
}

/**
 * Vale baixar agora? Probabilidade × tempo poupado (duas idas e voltas e o
 * download, pela rede estimada pelo navegador) contra o custo dos bytes
 * (Padmanabhan e Mogul, 1996).
 */
export function worth(p: number, bytes: number, byteCost = 0.0005, net: { rtt?: number; downlink?: number } | undefined = (navigator as any).connection): boolean {
  const rtt = net?.rtt || 100
  const mbps = net?.downlink || 10
  const saved = 2 * rtt + (bytes * 8) / (mbps * 1000)
  return p * saved > byteCost * bytes
}

/** Bytes que o remote `name` baixou (Resource Timing), pela pasta do manifesto. */
function bytesOf(name: string): number {
  const url = protocol().entry(name)?.url
  if (!url || typeof performance === 'undefined') return 0
  const dir = url.slice(0, url.lastIndexOf('/') + 1)
  let total = 0
  for (const e of performance.getEntriesByType('resource') as PerformanceResourceTiming[]) if (e.name.startsWith(dir)) total += e.encodedBodySize || 0
  return total
}

const speculated = new Set<string>()
/** `<script type="speculationrules">` para o documento de `path`. */
function speculate(path: string): void {
  if (speculated.has(path) || !HTMLScriptElement.supports?.('speculationrules')) return
  speculated.add(path)
  const s = document.createElement('script')
  s.type = 'speculationrules'
  s.textContent = JSON.stringify({ prefetch: [{ source: 'list', urls: [path], eagerness: 'immediate' }] })
  document.head.append(s)
}

const heat = (u: string) => fetch(u, { priority: 'low' }).then((res) => res.arrayBuffer())

function modulepreload(href: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const link = addLink('modulepreload', href, { fetchPriority: 'low' })
    link.onload = resolve
    link.onerror = reject
  })
}

/**
 * JS de um remote com integrity, pelo caminho que a montagem vai usar
 * (`core/sri.ts`): `verified()` acrescenta o import map com os hashes e aquece
 * os chunks (caminho 1) ou faz o `modulepreload` com integrity de tudo, só
 * onde o navegador confere esse hash (caminho 2). O módulo fica no mapa de
 * módulos já conferido. No caminho 1 a entrada e, no 3, todos os arquivos
 * só vão para o cache HTTP com `fetch`: o hash é conferido na montagem. O
 * WebKit, que ignora o integrity do modulepreload, nunca passa pelo 2.
 */
async function verifiedOnly(r: Verifiable): Promise<void> {
  const b = r.split ?? { entry: r.entry, chunks: [], sri: { [r.entry]: r.integrity }, priority: 'low' as const }
  const { verified } = await import('./core/sri')
  const url = await verified(b)
  if (!url) await Promise.all([...b.chunks, b.entry].map(heat))
  else if (!document.querySelector(`link[rel=modulepreload][href="${CSS.escape(url)}"]`)) await heat(url)
}

/**
 * Baixa o manifesto e os arquivos de um remote sem executar nada. Com
 * integrity, pelo mesmo caminho de SRI que a montagem vai usar. Devolve
 * false se o remote não pôde ser pré-carregado (sem erro no console).
 */
export async function warm(name: string): Promise<boolean> {
  try {
    const p = protocol()
    await p.pending()
    // Parte (`carrinho/Mini`): pré-carrega o remote registrado.
    let n = name
    while (n && !p.entry(n)) n = n.slice(0, Math.max(0, n.lastIndexOf('/')))
    const entry = p.entry(n)
    // No iframe o JS roda em outro documento; sem URL, o remote é local.
    if (!entry?.url || (entry.isolate ?? p.settings().isolate) === 'iframe') return false
    const r = await resolveEntry(n, entry as RemoteEntry & { url: string }, 'low')
    const css = r.css.map(heat)
    await Promise.all([r.integrity ? verifiedOnly(r as Verifiable) : modulepreload(r.entry), ...css])
    return true
  } catch {
    return false
  }
}
