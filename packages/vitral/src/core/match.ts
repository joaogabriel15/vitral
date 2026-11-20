/**
 * Rotas → remote, sem DOM: o `<vitral-outlet>` (`vitral/routes`) e o gateway
 * (`vitral/edge`) usam o mesmo mapa e a mesma regra.
 */

/**
 * Padrão de URL → nome do remote. Quando mais de uma bate, vence a mais
 * específica, em qualquer ordem: mais segmentos fixos, depois mais segmentos,
 * depois sem `*`. Empate fica com a que vem primeiro.
 */
export type Routes = Record<string, string>

export interface RouteMatch {
  /** Nome do remote. */
  name: string
  /** Padrão que bateu. */
  pattern: string
  /** Segmentos `:nome` do padrão. */
  params: Record<string, string>
}

const compiled = new Map<string, RegExp>()

function compile(pattern: string): RegExp {
  let re = compiled.get(pattern)
  if (!re) {
    const body = pattern
      .replace(/\/\*$|^\*$/, '\0')
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/:(\w+)/g, '(?<$1>[^/]+)')
      .replace(/\/$/, '')
      .replace('\0', '(?:/.*)?')
    compiled.set(pattern, (re = new RegExp(`^${body}/?$`)))
  }
  return re
}

/** `[fixos, segmentos, sem *]` de um padrão: maior é mais específico. */
export function specificity(pattern: string): [number, number, number] {
  const wild = /(^|\/)\*$/.test(pattern)
  const parts = pattern.replace(/(^|\/)\*$/, '').split('/').filter(Boolean)
  return [parts.filter((p) => p[0] != ':').length, parts.length, wild ? 0 : 1]
}

const ordered = new WeakMap<Routes, [string, string][]>()

/** Rotas da mais específica para a menos (ordem estável no empate). */
function byPriority(routes: Routes): [string, string][] {
  let list = ordered.get(routes)
  if (!list) {
    const score = (p: string) => specificity(p).reduce((n, x) => n * 1000 + x, 0)
    list = Object.entries(routes).sort(([a], [b]) => score(b) - score(a))
    ordered.set(routes, list)
  }
  return list
}

/** Padrões que batem com os mesmos caminhos (`/produto/:id` e `/produto/:slug/`), com os remotes de cada um. */
export function duplicates(routes: Routes): string[][] {
  const groups = new Map<string, string[]>()
  for (const [pattern, name] of Object.entries(routes)) {
    const key = pattern.replace(/:\w+/g, ':').replace(/(.)\/$/, '$1')
    groups.set(key, [...(groups.get(key) ?? []), `${pattern} (${name})`])
  }
  return [...groups.values()].filter((g) => g.length > 1)
}

/**
 * Remote da rota que bate com `path`, ou `null`. Padrões: `/conta` (exato),
 * `/checkout/*` (o prefixo e tudo abaixo dele), `/produto/:id` e `*` (qualquer).
 * A ordem do mapa não importa: vence a rota mais específica.
 */
export function matchRoute(path: string, routes: Routes): RouteMatch | null {
  for (const [pattern, name] of byPriority(routes)) {
    const m = compile(pattern).exec(path)
    if (m) return { name, pattern, params: { ...m.groups } }
  }
  return null
}
