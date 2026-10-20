/**
 * Rotas → remote, sem DOM: o `<vitral-outlet>` (`vitral/routes`) e o gateway
 * (`vitral/edge`) usam o mesmo mapa e a mesma regra.
 */

/** Padrão de URL → nome do remote. A primeira rota que bate vence. */
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

/**
 * Remote da rota que bate com `path`, ou `null`. Padrões: `/conta` (exato),
 * `/checkout/*` (o prefixo e tudo abaixo dele), `/produto/:id` e `*` (qualquer).
 */
export function matchRoute(path: string, routes: Routes): RouteMatch | null {
  for (const [pattern, name] of Object.entries(routes)) {
    const m = compile(pattern).exec(path)
    if (m) return { name, pattern, params: { ...m.groups } }
  }
  return null
}
