/**
 * Traduções dos remotes (`i18n` do `vitral.json`). Módulo à parte, baixado só
 * quando um manifesto traz traduções e o host passou `configure({ i18n })`.
 *
 * Cada remote baixa só a língua aberta, junto com o JS, e as traduções entram
 * no i18next (ou no que o host usar) antes da montagem. Numa troca de língua,
 * os remotes já carregados baixam a língua nova.
 */
import type { I18nHost } from './types'
import { absolute, fetchJson } from './util'

type Files = Record<string, Record<string, string>>
/** `i18n` do manifesto (língua → namespace → arquivo) e a URL do manifesto. */
export type Translations = { files: Files; base: string }

/** Arquivo já pedido → a promessa, para não baixar duas vezes. */
const asked = new Map<string, Promise<boolean>>()
/** Traduções de cada remote carregado, para as trocas de língua. */
const remotes = new Map<string, { files: Files; sri: Record<string, string> }>()
let watching: I18nHost | undefined
let stop: (() => void) | undefined

/**
 * Língua do remote para a língua aberta: a mesma, a base (`pt` para `pt-BR`),
 * uma variante da base (`pt-PT` para `pt`), ou a primeira do `fallback` que o
 * remote tiver.
 */
export function pickLanguage(lng: string, available: string[], fallback: string[] = []): string | undefined {
  const low = available.map((a) => a.toLowerCase())
  const base = (x: string) => x.toLowerCase().split(/[-_]/)[0]
  for (const want of [lng, ...fallback]) {
    if (!want) continue
    const exact = low.indexOf(want.toLowerCase())
    if (exact >= 0) return available[exact]
    const b = low.indexOf(base(want))
    if (b >= 0) return available[b]
    const variant = low.findIndex((a) => base(a) === base(want))
    if (variant >= 0) return available[variant]
  }
}

/** Baixa e junta as traduções de `name` na língua aberta. Resolve `true` se algo novo entrou. */
export function loadTranslations(name: string, t: Translations, sri: Record<string, string>, host: I18nHost, timeout: number, priority?: RequestPriority): Promise<boolean> {
  const files: Files = {}
  for (const lng in t.files) for (const ns in t.files[lng]) (files[lng] ??= {})[ns] = absolute(t.files[lng][ns], t.base)
  remotes.set(name, { files, sri })
  watch(host, timeout)
  return load(name, files, sri, host, host.language(), timeout, priority)
}

function load(name: string, files: Files, sri: Record<string, string>, host: I18nHost, lng: string, timeout: number, priority?: RequestPriority): Promise<boolean> {
  const pick = pickLanguage(lng, Object.keys(files), host.fallback?.() ?? [])
  if (!pick) return Promise.resolve(false)
  return Promise.all(
    Object.entries(files[pick]).map(([ns, url]) => {
      let p = asked.get(url)
      if (!p) {
        // `same-origin`: o modo do `<link rel="preload" crossorigin>` que o host Next põe no HTML.
        p = fetchJson(url, timeout, name, { credentials: 'same-origin', priority, ...(sri[url] && { integrity: sri[url] }) }).then((data) => {
          host.add(pick, ns, data)
          return true
        })
        // Uma falha pode tentar de novo na próxima montagem.
        p.catch(() => asked.delete(url))
        asked.set(url, p)
        return p
      }
      return p.then(() => false)
    }),
  ).then((added) => added.includes(true))
}

/** Numa troca de língua, cada remote já carregado baixa a nova; depois a tela desenha de novo. */
function watch(host: I18nHost, timeout: number): void {
  if (watching === host || !host.onChange) return
  stop?.()
  watching = host
  stop = host.onChange((lng) => {
    Promise.all([...remotes].map(([name, r]) => load(name, r.files, r.sri, host, lng, timeout).catch(() => false))).then((added) => {
      if (added.includes(true)) host.refresh?.()
    })
  })
}

/** Para os testes. */
export function resetTranslations(): void {
  stop?.()
  asked.clear()
  remotes.clear()
  watching = stop = undefined
}
