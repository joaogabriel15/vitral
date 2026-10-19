/**
 * Overrides de desenvolvimento: trocam a URL de um remote para apontar a
 * página (até a de produção, com a flag) para um `vite dev` local ou para o
 * preview de um PR.
 *
 *   ?vitral=carrinho@http://localhost:5174,conta@http://localhost:5175
 *   ?vitral=carrinho@pr-123     (com configure({ devOverrides: { preview } }))
 *   ?vitral=off                 (limpa todos)
 *   localStorage['vitral:overrides'] = '{"carrinho":"http://localhost:5174"}'
 *
 * Os de `?vitral=` ficam guardados na aba (sessionStorage): continuam valendo
 * depois de navegar ou recarregar sem o parâmetro. Os do localStorage (painel
 * de `vitral/devtools`) valem em todas as abas até serem removidos.
 *
 * Só valem com `configure({ devOverrides })` ou com a página em localhost: em
 * produção, um link com `?vitral=` executaria código de qualquer origem (XSS).
 */
import { protocol } from './state'
import type { RemoteEntry } from './types'

export const OVERRIDES_KEY = 'vitral:overrides'

export function overridesEnabled(): boolean {
  return !!protocol().settings().devOverrides || (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname))
}

/** URL base (`http://localhost:5174`) vira a do manifesto (`…/vitral.json`). */
export const manifestUrl = (url: string) => (/\.(json|m?js)(\?|$)/.test(url) ? url : url.replace(/\/?$/, '/vitral.json'))

/** `pr-123`, `main`, `1.4.0`: apelido resolvido pelo modelo `devOverrides.preview`. */
export const isRef = (value: string) => /^[\w.-]+$/.test(value)

const read = (store: () => Storage): Record<string, string> => {
  try {
    return JSON.parse(store().getItem(OVERRIDES_KEY) ?? '{}') ?? {}
  } catch {
    return {}
  }
}

const write = (store: () => Storage, all: Record<string, string>) => {
  try {
    if (Object.keys(all).length) store().setItem(OVERRIDES_KEY, JSON.stringify(all))
    else store().removeItem(OVERRIDES_KEY)
  } catch {}
}

const local = () => localStorage
const session = () => sessionStorage

/** Overrides salvos no navegador (os do painel de `vitral/devtools`). */
export const storedOverrides = () => read(local)

/** Salva (ou remove, com `null`) um override no localStorage. */
export function storeOverride(name: string, value: string | null): void {
  const all = storedOverrides()
  if (value) all[name] = isRef(value) ? value : manifestUrl(value)
  else delete all[name]
  write(local, all)
}

/**
 * Overrides da aba: os de `?vitral=` desta URL somados aos de URLs anteriores
 * da mesma aba. `?vitral=off` limpa todos (aba e navegador); `nome@off`
 * limpa um.
 */
function tabOverrides(): Record<string, string> {
  const all = read(session)
  const pairs = new URLSearchParams(location.search).getAll('vitral').join(',').split(',')
  if (!pairs.some(Boolean)) return all
  for (const pair of pairs) {
    const at = pair.indexOf('@')
    if (pair === 'off') clearOverrides(), Object.keys(all).forEach((k) => delete all[k])
    else if (at > 0 && pair.slice(at + 1) === 'off') delete all[pair.slice(0, at)]
    else if (at > 0) all[pair.slice(0, at)] = pair.slice(at + 1)
  }
  write(session, all)
  return all
}

/** Remove todos os overrides: os da aba e os do navegador. */
export function clearOverrides(): void {
  write(session, {})
  write(local, {})
}

/** Remove o override de `name` da aba e do navegador. */
export function dropOverride(name: string): void {
  for (const store of [session, local]) {
    const all = read(store)
    delete all[name]
    write(store, all)
  }
}

/** Override ativo. `url` fica vazia quando um apelido não tem modelo para resolver. */
export interface ActiveOverride {
  name: string
  /** Como foi pedido: URL ou apelido (`pr-123`). */
  value: string
  url?: string
  /** `'aba'`: veio de `?vitral=` nesta aba. `'navegador'`: do localStorage. */
  source: 'aba' | 'navegador'
}

/** Resolve uma URL ou um apelido para a URL do manifesto. */
export function resolveOverride(name: string, value: string): string | undefined {
  if (!isRef(value)) return new URL(manifestUrl(value), location.href).href
  const d = protocol().settings().devOverrides
  const preview = typeof d === 'object' ? d.preview : undefined
  if (!preview) return
  const url = preview.replace(/\{name\}/g, encodeURIComponent(name)).replace(/\{ref\}/g, encodeURIComponent(value))
  return new URL(manifestUrl(url), location.href).href
}

/** Overrides que valem nesta página. Os da aba têm prioridade sobre os do navegador. */
export function activeOverrides(): ActiveOverride[] {
  const tab = tabOverrides()
  const all: Record<string, ActiveOverride> = {}
  for (const [source, map] of [['navegador', storedOverrides()], ['aba', tab]] as const) {
    for (const [name, value] of Object.entries(map)) all[name] = { name, value, url: resolveOverride(name, value), source }
  }
  return Object.values(all)
}

const warned = new Set<string>()

/** Entrada que substitui `name`, se houver override ativo. */
export function overrideFor(name: string): RemoteEntry | undefined {
  if (!overridesEnabled()) return
  const o = activeOverrides().find((o) => o.name === name)
  if (!o) return
  const first = !warned.has(name) && warned.add(name)
  if (!o.url) {
    if (first) console.warn(`[vitral] override ${name}@${o.value} ignorado: falta configure({ devOverrides: { preview } })`)
    return
  }
  // Override é escolha explícita de quem desenvolve: a origem dele vale mesmo com allowedOrigins.
  const p = protocol()
  const trusted = p.settings().trusted ?? []
  const origin = new URL(o.url).origin
  if (!trusted.includes(origin)) p.configure({ trusted: [...trusted, origin] })
  if (first) console.warn(`[vitral] override ativo: ${name} → ${o.url} (${o.source}). Para limpar: ?vitral=off`)
  return { url: o.url }
}
