/**
 * O que a primeira tela de um remote baixa, para os `<link rel="preload">` do
 * HTML do host Next: o manifesto, o CSS e o JS (entrada, chunks e as cópias
 * de dedupe que o host não oferece). Serve ao build (`withVitral`, que lê o
 * `vitral.json` do disco) e ao servidor (`vitral/next-server`, a cada
 * requisição).
 */
import { satisfies } from './semver'
import type { RemoteManifest } from './types'

/** `[href, integrity]` de cada arquivo que o HTML da página do remote pré-carrega. */
export interface HtmlHints {
  manifest: string
  css: [string, string?][]
  js: [string, string?][]
  /** Grupos de `share` que o remote vai pedir: o host começa o download deles antes da hidratação. */
  offers?: string[]
}

/** `offered`: versão de cada grupo que o host oferece. `integrity: false` tira os hashes. */
export function hintsOf(m: RemoteManifest, url: string, offered: Record<string, string>, integrity?: false): HtmlHints {
  const base = new URL(url, 'http://host.invalid/')
  const at = (f: string) => {
    const u = new URL(f, base)
    return u.origin === 'http://host.invalid' ? u.pathname + u.search : u.href
  }
  const hint = (f: string): [string, string?] => (integrity !== false && m.files?.[f] ? [at(f), m.files[f]] : [at(f)])
  const served = (d: { name: string; range: string }) => !!offered[d.name] && satisfies(offered[d.name], d.range)
  const own = (m.dedupe ?? []).filter((d) => !served(d)).flatMap((d) => [...(d.chunks ?? []), d.file])
  const offers = m.split ? (m.dedupe ?? []).filter((d) => d.name !== 'react' && served(d)).map((d) => d.name) : []
  return {
    manifest: at(url),
    css: (m.css ?? []).map(hint),
    js: (m.split ? [...own, ...(m.split.chunks ?? []), m.split.entry] : [m.entry]).map(hint),
    ...(offers.length && { offers }),
  }
}
