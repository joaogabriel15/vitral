/**
 * O HTML que o servidor escreve no lugar do remote, sem Shadow DOM: o mesmo
 * DOM que a montagem cria, para a hidratação (`core/hydrate.ts`) reusar.
 * Serve ao gateway (`vitral/edge`) e ao host Next (`vitral/next-server`).
 */
import type { RemoteManifest } from './types'

/** O que o `render` do servidor devolve: o HTML, ou o HTML e o estado inicial. */
export type ServerRendered = string | { html: string; state?: unknown }

const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
/** JSON dentro de `<script>`: `<` escapado, para o texto não fechar a tag. */
export const inlineJson = (v: unknown): string => JSON.stringify(v).replace(/</g, '\\u003c')

/** `<script type="application/json" data-vitral-state>` com o estado do SSR. */
export function stateScript(r: ServerRendered): string {
  return typeof r === 'object' && r.state !== undefined ? `<script type="application/json" data-vitral-state>${inlineJson(r.state)}</script>` : ''
}

export const htmlOf = (r: ServerRendered): string => (typeof r === 'string' ? r : r.html)

/**
 * `<div data-vitral-ssr>` com o estado, o manifesto (`seed`), o CSS e a raiz.
 * `css`: `[href, integrity]` já resolvidos.
 */
export function ssrHolder(name: string, m: Pick<RemoteManifest, 'scope'>, rendered: ServerRendered, css: [string, string?][], seed?: [url: string, manifest: unknown]): string {
  const n = attr(name)
  const scope = m.scope ? ` data-vitral-scope="${attr(m.scope)}"` : ''
  const links = css.map(([href, sri]) => `<link rel="stylesheet" href="${attr(href)}" crossorigin="anonymous"${sri ? ` integrity="${attr(sri)}"` : ''}>`).join('')
  const manifest = seed ? `<script type="application/json" data-vitral-manifest="${attr(seed[0])}">${inlineJson(seed[1])}</script>` : ''
  return `<div data-vitral-ssr data-vitral-slot="${n}">${manifest}${stateScript(rendered)}${links}<div data-vitral-root="${n}"${scope} style="display:contents">${htmlOf(rendered)}</div></div>`
}
