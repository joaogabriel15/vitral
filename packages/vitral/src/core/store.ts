/**
 * Store do contexto compartilhado, no nível do protocolo.
 *
 * Esta é a parte que cópias diferentes da lib combinam entre si: chaves de
 * texto, valores imutáveis comparados com `Object.is`, um dono por chave e
 * notificações agrupadas por `batch`. A API de quem usa (`provide`, `shared`,
 * hooks) mora em `shared.ts` e só fala com este objeto pelos métodos abaixo.
 */
import { protocol } from './state'

/** Uma chave do store vista de fora (devtools, SSR, ponte do iframe). */
export interface SharedEntry {
  key: string
  value: unknown
  /** `false` quando só o dono altera. */
  writable: boolean
  /** Quem é o dono (nome do remote; vazio para o host ou sem nome). */
  owner?: string
  /** Quem fez a última mudança. */
  by?: string
  /** Quantas assinaturas ativas a chave tem. */
  subscribers: number
}

/**
 * Store guardado no protocolo global (`globalThis[Symbol.for('vitral')].shared()`).
 * Faz parte do protocolo v1: só cresce com métodos novos.
 */
export interface SharedStore {
  /** Valor atual; `undefined` se a chave ainda não tem valor. */
  get(key: string): unknown
  /**
   * Troca o valor. Passa se `token` é o do dono ou se a chave aceita escrita.
   * Devolve `false` quando a escrita foi bloqueada (`writable: false`).
   */
  set(key: string, value: unknown, token?: object, by?: string): boolean
  /** Chama `fn(valor)` a cada mudança (não na hora). Devolve a função que cancela. */
  subscribe(key: string, fn: (value: unknown) => void): () => void
  /**
   * Torna-se dono de uma chave sem dono e grava `value` (um valor vindo do
   * SSR ainda não reivindicado é mantido). Devolve o token do dono, ou
   * `undefined` se a chave já tem dono.
   */
  own(key: string, value: unknown, writable: boolean, by?: string): object | undefined
  /** O dono larga a chave. O valor fica e a chave volta a aceitar escrita. */
  release(key: string, token: object): void
  /** Roda `fn` e notifica cada chave alterada uma vez só, no fim. */
  batch<R>(fn: () => R): R
  /** Chaves com valor e seus metadados. */
  list(): SharedEntry[]
}

// Estado de cada chave. Nomes curtos de propósito: este código entra no
// bundle de quem usa o store, e o minificador não encurta propriedades.
interface Slot {
  /** Valor. A chave só tem valor quando `'v' in slot`. */
  v?: unknown
  /** Assinantes. */
  s: Set<(value: unknown) => void>
  /** Token do dono. */
  t?: object
  /** Só leitura (`writable: false`). */
  r?: boolean
  /** Nome do dono. */
  o?: string
  /** Quem mudou por último. */
  b?: string
  /** Valor do SSR ainda não reivindicado: o primeiro dono o mantém. */
  d?: boolean
}

/** Cria um store isolado. `seed` são valores iniciais sem dono (ex.: vindos do SSR). */
export function createStore(seed: Record<string, unknown> = {}): SharedStore {
  const slots = new Map<string, Slot>()
  // Chaves alteradas desde a última notificação, com o valor de antes.
  const changed = new Map<Slot, unknown>()
  let depth = 0

  const slot = (key: string) => {
    let x = slots.get(key)
    if (!x) slots.set(key, (x = { s: new Set() }))
    return x
  }
  const flush = () => {
    if (depth) return
    const list = [...changed]
    changed.clear()
    for (const [x, before] of list) {
      if (Object.is(x.v, before)) continue
      for (const fn of [...x.s]) {
        try {
          fn(x.v)
        } catch (e) {
          console.error(e)
        }
      }
    }
  }
  const write = (x: Slot, value: unknown, by?: string) => {
    if ('v' in x && Object.is(x.v, value)) return
    if (!changed.has(x)) changed.set(x, x.v)
    x.v = value
    x.b = by
    flush()
  }

  for (const key in seed) slots.set(key, { v: seed[key], s: new Set(), d: true })

  return {
    get: (key) => slots.get(key)?.v,
    set(key, value, token, by) {
      const x = slot(key)
      if (x.r && token !== x.t) return false
      write(x, value, by)
      return true
    },
    subscribe(key, fn) {
      const subs = slot(key).s
      // Embrulha para a mesma função poder assinar duas vezes.
      const f = (v: unknown) => fn(v)
      subs.add(f)
      return () => void subs.delete(f)
    },
    own(key, value, writable, by) {
      const x = slot(key)
      if (x.t) return
      if (!x.d) write(x, value, by)
      x.d = false
      x.r = !writable
      x.o = by
      return (x.t = {})
    },
    release(key, token) {
      const x = slots.get(key)
      if (x && x.t === token) x.t = x.r = x.o = undefined
    },
    batch(fn) {
      depth++
      try {
        return fn()
      } finally {
        depth--
        flush()
      }
    },
    list: () =>
      [...slots]
        .filter(([, x]) => 'v' in x)
        .map(([key, x]) => ({ key, value: x.v, writable: !x.r, owner: x.o, by: x.b, subscribers: x.s.size })),
  }
}

/** Valores do SSR: `<script type="application/json" data-vitral-shared>`. JSON inválido não impede o store. */
function hydrate(): Record<string, unknown> | undefined {
  try {
    return JSON.parse(document.querySelector('script[data-vitral-shared]')?.textContent || '{}')
  } catch (e) {
    console.error(e)
  }
}

/**
 * Store da página, guardado no protocolo global. A primeira cópia da lib que
 * precisar dele instala o método `shared` (inclusive num protocolo instalado
 * por uma versão antiga, que não tinha store). No servidor não há store
 * global: cada chamada recebe um store novo, para nada vazar entre requisições.
 */
export function pageStore(): SharedStore {
  if (typeof document === 'undefined') return createStore()
  const p = protocol()
  if (!p.shared) {
    const store = createStore(hydrate())
    p.shared = () => store
  }
  return p.shared()
}
