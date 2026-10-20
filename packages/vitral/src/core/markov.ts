/**
 * Cadeia de Markov de primeira ordem das rotas (`vitral/prefetch`): conta as
 * transições `de → para` e guarda quais remotes cada rota monta. Tudo em
 * objetos simples, para caber no localStorage como JSON.
 */
export interface Chain {
  /** Transições: rota de origem → rota seguinte → contagem. */
  t: Record<string, Record<string, number>>
  /** Remotes montados em cada rota. */
  r: Record<string, string[]>
}

/** Limites de tamanho: rotas guardadas, destinos por rota, remotes por rota e contagem por rota. */
export const LIMITS = { routes: 50, next: 10, remotes: 8, total: 1000, key: 200 }

const ok = (k: string) => typeof k === 'string' && k.length <= LIMITS.key && k !== '__proto__'
const sum = (row: Record<string, number>) => Object.values(row).reduce((a, b) => a + b, 0)
const smallest = (o: Record<string, number>, keep: string) =>
  Object.keys(o)
    .filter((k) => k !== keep)
    .reduce<string | undefined>((min, k) => (min === undefined || o[k] < o[min] ? k : min), undefined)

export const empty = (): Chain => ({ t: {}, r: {} })

/** Lê o JSON guardado. Qualquer coisa fora do formato vira uma cadeia vazia. */
export function parse(text: string | null | undefined): Chain {
  try {
    const c = JSON.parse(text ?? '')
    const rows = Object.values(c.t).every((row: any) => row && typeof row === 'object' && Object.values(row).every((n) => Number.isFinite(n)))
    const lists = Object.values(c.r).every((l) => Array.isArray(l) && l.every((n) => typeof n === 'string'))
    if (rows && lists) return c
  } catch {}
  return empty()
}

/** Conta a transição `from → to`, dentro dos limites. */
export function record(c: Chain, from: string, to: string): void {
  if (from === to || !ok(from) || !ok(to)) return
  const row = (c.t[from] ??= {})
  row[to] = (row[to] ?? 0) + 1
  // Rota muito visitada: metade das contagens, para o passado recente pesar mais.
  if (sum(row) > LIMITS.total) for (const k in row) if (!(row[k] >>= 1)) delete row[k]
  if (Object.keys(row).length > LIMITS.next) delete row[smallest(row, to)!]
  if (Object.keys(c.t).length > LIMITS.routes) {
    const totals = Object.fromEntries(Object.entries(c.t).map(([k, v]) => [k, sum(v)]))
    delete c.t[smallest(totals, from)!]
  }
}

/** Guarda que `route` monta `remote`. Devolve true se mudou algo. */
export function remember(c: Chain, route: string, remote: string): boolean {
  if (!ok(route)) return false
  const list = (c.r[route] ??= [])
  if (list.includes(remote)) return false
  list.push(remote)
  if (list.length > LIMITS.remotes) list.shift()
  const routes = Object.keys(c.r)
  if (routes.length > LIMITS.routes) delete c.r[routes.find((k) => k !== route)!]
  return true
}

/**
 * Rota seguinte mais provável depois de `from`, se a probabilidade dela for
 * pelo menos `threshold` e houver pelo menos `min` transições contadas.
 */
export function predict(c: Chain, from: string, threshold: number, min = 1): string | null {
  const row = Object.prototype.hasOwnProperty.call(c.t, from) ? c.t[from] : undefined
  if (!row) return null
  const total = sum(row)
  let best: string | null = null
  for (const k in row) if (best === null || row[k] > row[best]) best = k
  return best !== null && total >= min && row[best] / total >= threshold ? best : null
}
