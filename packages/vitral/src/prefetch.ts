/**
 * Prefetch preditivo de remotes:
 *
 *   import { prefetch } from 'vitral/prefetch'
 *   prefetch()
 *
 * Conta as transições entre rotas (cadeia de Markov de primeira ordem) e quais
 * remotes cada rota monta, no localStorage. No tempo ocioso, baixa o manifesto
 * e os arquivos dos remotes da rota seguinte mais provável, sem executar nada
 * e com o SRI do vitral (`core/sri.ts`).
 */
import { resolveEntry } from './core/loader'
import { empty, parse, predict, record, remember, type Chain } from './core/markov'
import type { Verifiable } from './core/sri'
import { protocol } from './core/state'
import type { RemoteEntry } from './core/types'
import { addLink } from './core/util'

export interface PrefetchOptions {
  /** Probabilidade mínima da rota seguinte para baixar os remotes dela. Padrão: 0.4. */
  threshold?: number
  /** Transições contadas a partir da rota atual antes de prever. Padrão: 2. */
  min?: number
  /** Onde guardar as contagens. `null` guarda só na memória. Padrão: localStorage. */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
  /** Chave da rota. Padrão: `url.pathname`. */
  key?: (url: URL) => string
  /** Chamado depois de baixar os remotes previstos. */
  onPrefetch?: (remotes: string[], route: string) => void
}

const KEY = 'vitral:prefetch'

/** Conexão com economia de dados ou 2G: não baixa nada a mais. */
function slow(): boolean {
  const c = (navigator as any).connection
  return !!c?.saveData || /2g/.test(c?.effectiveType ?? '')
}

const idle = (fn: () => void) =>
  typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 300)

/**
 * Começa a aprender as rotas e a pré-carregar o próximo remote. Devolve a
 * função que para tudo (as contagens continuam guardadas).
 */
export function prefetch(options: PrefetchOptions = {}): () => void {
  if (typeof window === 'undefined') return () => {}
  const { threshold = 0.4, min = 2, key = (u: URL) => u.pathname, onPrefetch } = options
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
  // Remotes já baixados nesta página (montados ou pré-carregados).
  const loaded = new Set<string>()
  let seq = 0

  const schedule = () => {
    const id = ++seq
    if (slow()) return
    idle(() => {
      const next = id === seq && predict(chain, current, threshold, min)
      if (!next) return
      const names = (chain.r[next] ?? []).filter((n) => !loaded.has(n))
      if (!names.length) return
      for (const n of names) loaded.add(n)
      Promise.all(names.map(warm)).then((ok) => {
        const done = names.filter((_, i) => ok[i])
        if (done.length) onPrefetch?.(done, next)
      })
    })
  }

  const visit = () => {
    const next = here()
    if (next === current) return
    record(chain, current, next)
    current = next
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
  schedule()
  return () => {
    seq++
    observer?.disconnect()
    target.removeEventListener(event, visit)
  }
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
