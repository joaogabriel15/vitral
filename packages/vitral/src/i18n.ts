/**
 * Traduções dos remotes no i18next do host.
 *
 * ```ts
 * import i18n from 'i18next'
 * import { configure } from 'vitral'
 * import { i18next } from 'vitral/i18n'
 *
 * configure({ remotes, i18n: i18next(i18n) })
 * ```
 *
 * Cada remote com `i18n` no plugin baixa só a língua aberta, junto com o JS,
 * e as traduções entram nesta instância antes da montagem. Com `dedupe:
 * ['i18next', 'react-i18next']` no remote, o `useTranslation` dele lê daqui.
 */
import { languageReady } from './core/i18n'
import type { I18nHost } from './core/types'

export type { I18nHost } from './core/types'
export { languageReady, pickLanguage } from './core/i18n'

/** O que o vitral usa de uma instância do i18next. */
export interface I18nextLike {
  language?: string
  options?: { fallbackLng?: unknown }
  addResourceBundle(lng: string, ns: string, resources: any, deep?: boolean, overwrite?: boolean): unknown
  on(event: 'languageChanged', fn: (lng: string) => void): unknown
  off(event: 'languageChanged', fn: (lng: string) => void): unknown
  changeLanguage(lng?: string, ...rest: any[]): unknown
}

/** Instâncias cujo `changeLanguage` já espera as traduções dos remotes. */
const ready = new WeakMap<I18nextLike, I18nextLike['changeLanguage']>()

/** `fallbackLng` do i18next (texto, lista, objeto por língua ou função) como lista. */
export function fallbacks(value: unknown, lng = ''): string[] {
  if (typeof value === 'function') return fallbacks(value(lng), lng)
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === 'string')
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    return [...fallbacks(o[lng]), ...fallbacks(o[lng.split('-')[0]]), ...fallbacks(o.default)]
  }
  return []
}

/**
 * Adaptador de uma instância do i18next para `configure({ i18n })`.
 *
 * O `changeLanguage` da instância passa a baixar antes as traduções da nova
 * língua dos remotes já carregados: a tela troca já com os textos certos, e
 * enquanto os arquivos chegam fica a língua anterior (nunca as chaves).
 */
export function i18next(i: I18nextLike): I18nHost {
  let change = ready.get(i)
  if (!change) {
    const original = i.changeLanguage
    change = original.bind(i)
    ready.set(i, change)
    i.changeLanguage = (lng?: string, ...rest: any[]) => (lng ? languageReady(lng).then(() => original.call(i, lng, ...rest)) : original.call(i, lng, ...rest))
  }
  const set = change
  return {
    language: () => i.language ?? '',
    fallback: () => fallbacks(i.options?.fallbackLng, i.language),
    add: (lng, ns, data) => void i.addResourceBundle(lng, ns, data, true, true),
    onChange(fn) {
      i.on('languageChanged', fn)
      return () => void i.off('languageChanged', fn)
    },
    // O react-i18next desenha de novo no `languageChanged`, não quando um namespace entra.
    refresh: () => void set(i.language),
  }
}
