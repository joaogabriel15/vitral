/**
 * Overrides de desenvolvimento: trocam a URL de um remote para apontar a
 * página (até a de produção, com a flag) para um `vite dev` local.
 *
 *   ?vitral=carrinho@http://localhost:5174,conta@http://localhost:5175
 *   localStorage['vitral:overrides'] = '{"carrinho":"http://localhost:5174"}'
 *
 * Só valem com `configure({ devOverrides: true })` ou com a página em
 * localhost: em produção, um link com `?vitral=` executaria código de
 * qualquer origem (XSS).
 */
import { protocol } from './state'
import type { RemoteEntry } from './types'

export const OVERRIDES_KEY = 'vitral:overrides'

export function overridesEnabled(): boolean {
  return !!protocol().settings().devOverrides || (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname))
}

/** URL base (`http://localhost:5174`) vira a do manifesto (`…/vitral.json`). */
export const manifestUrl = (url: string) => (/\.(json|m?js)(\?|$)/.test(url) ? url : url.replace(/\/?$/, '/vitral.json'))

/** Overrides salvos no navegador (os do painel de `vitral/devtools`). */
export function storedOverrides(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDES_KEY) ?? '{}') ?? {}
  } catch {
    return {}
  }
}

const warned = new Set<string>()

/** Entrada que substitui `name`, se houver override ativo. */
export function overrideFor(name: string): RemoteEntry | undefined {
  if (!overridesEnabled()) return
  const all = storedOverrides()
  for (const pair of new URLSearchParams(location.search).getAll('vitral').join(',').split(',')) {
    const at = pair.indexOf('@')
    if (at > 0) all[pair.slice(0, at)] = pair.slice(at + 1)
  }
  if (!all[name]) return
  const url = new URL(manifestUrl(all[name]), location.href).href
  // Override é escolha explícita de quem desenvolve: a origem dele vale mesmo com allowedOrigins.
  const p = protocol()
  const trusted = p.settings().trusted ?? []
  const origin = new URL(url).origin
  if (!trusted.includes(origin)) p.configure({ trusted: [...trusted, origin] })
  if (!warned.has(name)) console.warn(`[vitral] override ativo: ${name} → ${url}`), warned.add(name)
  return { url }
}
