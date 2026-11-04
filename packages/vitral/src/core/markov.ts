/**
 * Cadeia de Markov das rotas (`vitral/prefetch`): conta as transições
 * `de → para` e guarda quais remotes cada rota monta. Tudo em objetos
 * simples, para caber no localStorage como JSON.
 *
 * As ordens 1 a 3 ficam na mesma tabela: a chave de ordem 2 é `a\nb` (as
 * duas últimas rotas). A previsão usa a ordem mais alta com suporte e
 * confiança suficientes e, sem elas, cai para a de baixo (Selective Markov
 * Models, Deshpande e Karypis, TOIT 2004).
 */
export interface Chain {
  /** Transições: rota (ou contexto) de origem → rota seguinte → contagem. */
  t: Record<string, Record<string, number>>
  /** Remotes montados em cada rota. */
  r: Record<string, string[]>
  /** Bytes que cada remote baixou da última vez (para o custo do prefetch). */
  b?: Record<string, number>
}

/**
 * Transições da população (dados agregados de muitos usuários), no mesmo
 * formato: ajuda na primeira visita, quando o usuário ainda não tem contagens.
 */
export interface Prior {
  t: Record<string, Record<string, number>>
  r?: Record<string, string[]>
}

/** Limites de tamanho: contextos guardados, destinos por contexto, remotes por rota e contagem por contexto. */
export const LIMITS = { routes: 150, next: 10, remotes: 8, total: 1000, key: 200 }

const own = <T>(o: Record<string, T> | undefined, k: string): T | undefined => (o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined)
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
    if (c.b && !Object.values(c.b).every((n) => Number.isFinite(n))) delete c.b
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

/** Conta `history → to` nas ordens 1 a `orders`. `history` termina na rota atual. */
export function recordPath(c: Chain, history: string[], to: string, orders = 3): void {
  if (history[history.length - 1] === to) return
  for (let k = 1; k <= orders && k <= history.length; k++) record(c, history.slice(-k).join('\n'), to)
}

export interface PredictOptions {
  /** Probabilidade mínima (confiança). Padrão 0. */
  threshold?: number
  /** Transições contadas no contexto antes de usá-lo (suporte). Padrão 2. */
  min?: number
  prior?: Prior | null
  /** Peso da população, em transições: contagens do usuário + `alpha` × população. Padrão 5. */
  alpha?: number
  /** Ordem máxima. Padrão 3. */
  orders?: number
}

/**
 * Rota seguinte mais provável e a probabilidade dela. Tenta da ordem mais
 * alta para a mais baixa; um contexto entra só com `min` transições (ou,
 * na ordem 1, com dados da população) e uma previsão só com `threshold`.
 */
export function predictNext(c: Chain, history: string[], o: PredictOptions = {}): { to: string; p: number } | null {
  const { threshold = 0, min = 2, prior, alpha = 5, orders = 3 } = o
  for (let k = Math.min(orders, history.length); k >= 1; k--) {
    const key = history.slice(-k).join('\n')
    const row = own(c.t, key) ?? {}
    const pop = k === 1 ? own(prior?.t, key) : undefined
    const n = sum(row)
    const total = pop ? sum(pop) : 0
    if (n < min && !total) continue
    const a = total ? alpha : 0
    let best: string | null = null
    let bp = 0
    for (const to of new Set([...Object.keys(row), ...Object.keys(pop ?? {})])) {
      if (!ok(to)) continue
      const p = ((own(row, to) ?? 0) + (a * (own(pop, to) ?? 0)) / (total || 1)) / (n + a)
      if (p > bp) (best = to), (bp = p)
    }
    if (best !== null && bp >= threshold) return { to: best, p: bp }
  }
  return null
}
