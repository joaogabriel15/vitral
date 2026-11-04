/**
 * O que a primeira tela de um remote baixa, para os `<link rel="preload">` do
 * HTML do host Next: o manifesto, o CSS e o JS (entrada, chunks e as cópias
 * de dedupe que o host não oferece). Serve ao build (`withVitral`, que lê o
 * `vitral.json` do disco) e ao servidor (`vitral/next-server`, a cada
 * requisição).
 */
import { critical, ordered } from './order'
import { satisfies } from './semver'
import type { RemoteManifest } from './types'

/** `[href, integrity, prioridade]` de cada arquivo que o HTML da página do remote pré-carrega. */
export type Hint = [string, string?, 'high'?]

export interface HtmlHints {
  manifest: string
  css: Hint[]
  /** Na ordem de download; o caminho crítico com `high`. */
  js: Hint[]
  /** Grupos de `share` que o remote vai pedir: o host começa o download deles antes da hidratação. */
  offers?: string[]
  /** Com `keys`: o `integrity` do preload do manifesto (só as assinaturas). */
  signed?: string
}

/**
 * `offered`: versão de cada grupo que o host oferece. `integrity: false` tira
 * os hashes. `keys`: as assinaturas vão junto, igual ao que o loader pede, para
 * o navegador reaproveitar o preload.
 */
export function hintsOf(m: RemoteManifest, url: string, offered: Record<string, string>, integrity?: false, keys?: string[]): HtmlHints {
  const k = (keys ?? []).map((x) => ' ed25519-' + x.replace(/^ed25519-/, '')).join('')
  const base = new URL(url, 'http://host.invalid/')
  const at = (f: string) => {
    const u = new URL(f, base)
    return u.origin === 'http://host.invalid' ? u.pathname + u.search : u.href
  }
  const crit = critical(m)
  const hint = (f: string): Hint => {
    const h: Hint = integrity !== false && m.files?.[f] ? [at(f), m.files[f] + k] : [at(f)]
    if (crit.has(f)) h[1] ??= undefined, (h[2] = 'high')
    return h
  }
  const served = (d: { name: string; range: string }) => !!offered[d.name] && satisfies(offered[d.name], d.range)
  const own = (m.dedupe ?? []).filter((d) => !served(d)).flatMap((d) => [...(d.chunks ?? []), d.file])
  const offers = m.split ? (m.dedupe ?? []).filter((d) => d.name !== 'react' && served(d)).map((d) => d.name) : []
  return {
    manifest: at(url),
    css: (m.css ?? []).map(hint),
    js: (m.split ? ordered([...own, ...(m.split.chunks ?? []), m.split.entry], m.split.order) : [m.entry]).map(hint),
    ...(offers.length && { offers }),
    ...(k && { signed: k.trim() }),
  }
}

